import { execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import type { ProcessMetrics } from './types';

export type ProcessSample = { cpu: number; memoryMb: number };

/**
 * One-shot CPU% + RSS (MB) for a PID via `ps` (Unix).
 * Uses `=` formats so there is no header row to parse.
 */
export function sampleProcess(pid: number): ProcessSample | null {
  if (!pid || pid <= 0) return null;
  try {
    const line = execSync(`ps -p ${pid} -o %cpu=,rss=`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
      .toString()
      .trim();
    if (!line) return null;
    const parts = line.split(/\s+/).map((p) => Number.parseFloat(p));
    const cpu = parts[0];
    const rssKb = parts[1];
    if (!Number.isFinite(cpu) || !Number.isFinite(rssKb)) return null;
    return { cpu: cpu!, memoryMb: rssKb! / 1024 };
  } catch {
    return null;
  }
}

/**
 * Cumulative CPU time (seconds) for a PID — `ps -o cputime=`.
 * Used for span-average CPU without timers.
 */
export function readCpuSeconds(pid: number): number | null {
  if (!pid || pid <= 0) return null;
  try {
    const raw = execSync(`ps -p ${pid} -o cputime=`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
      .toString()
      .trim();
    if (!raw) return null;
    return parseCpuTime(raw);
  } catch {
    return null;
  }
}

/** Parse `[[dd-]hh:]mm:ss` or `mm:ss.ss` into seconds. */
export function parseCpuTime(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const daySplit = s.split('-');
  let rest = s;
  let days = 0;
  if (daySplit.length === 2) {
    days = Number.parseInt(daySplit[0]!, 10);
    rest = daySplit[1]!;
    if (!Number.isFinite(days)) return null;
  }
  const parts = rest.split(':').map(Number.parseFloat);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) {
    return days * 86400 + parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }
  if (parts.length === 2) {
    return days * 86400 + parts[0]! * 60 + parts[1]!;
  }
  if (parts.length === 1) return days * 86400 + parts[0]!;
  return null;
}

export type SampleAccumulator = {
  maxMemoryMb: number;
  minMemoryMb: number;
  maxCpuPct: number;
  minCpuPct: number;
  totalMemoryMb: number;
  totalCpuPct: number;
  samples: number;
};

export function createSampleAccumulator(): SampleAccumulator {
  return {
    maxMemoryMb: 0,
    minMemoryMb: Infinity,
    maxCpuPct: 0,
    minCpuPct: Infinity,
    totalMemoryMb: 0,
    totalCpuPct: 0,
    samples: 0,
  };
}

export function pushSample(acc: SampleAccumulator, sample: ProcessSample): void {
  acc.maxCpuPct = Math.max(acc.maxCpuPct, sample.cpu);
  acc.minCpuPct = Math.min(acc.minCpuPct, sample.cpu);
  acc.totalCpuPct += sample.cpu;
  acc.maxMemoryMb = Math.max(acc.maxMemoryMb, sample.memoryMb);
  acc.minMemoryMb = Math.min(acc.minMemoryMb, sample.memoryMb);
  acc.totalMemoryMb += sample.memoryMb;
  acc.samples++;
}

export function finalizeSamples(acc: SampleAccumulator): ProcessMetrics {
  return {
    maxMemoryMb: acc.maxMemoryMb,
    minMemoryMb: Number.isFinite(acc.minMemoryMb) ? acc.minMemoryMb : 0,
    avgMemoryMb: acc.samples > 0 ? acc.totalMemoryMb / acc.samples : 0,
    maxCpuPct: acc.maxCpuPct,
    minCpuPct: Number.isFinite(acc.minCpuPct) ? acc.minCpuPct : 0,
    avgCpuPct: acc.samples > 0 ? acc.totalCpuPct / acc.samples : 0,
  };
}

const emptyMetrics = (): ProcessMetrics => ({
  maxMemoryMb: 0,
  minMemoryMb: 0,
  avgMemoryMb: 0,
  maxCpuPct: 0,
  minCpuPct: 0,
  avgCpuPct: 0,
});

/**
 * Explicit checkpoint sampler — call `note()` at phase boundaries.
 * Avg CPU over the span uses cumulative `cputime` / wall (no timers).
 */
export class ProcessSampler {
  private readonly acc = createSampleAccumulator();
  private wallStarted = performance.now();
  private cpuStarted: number | null = null;
  private begun = false;

  constructor(private readonly pid: number) {}

  /** First checkpoint (ready / build start). */
  begin(): void {
    this.begun = true;
    this.wallStarted = performance.now();
    this.cpuStarted = readCpuSeconds(this.pid);
    this.note();
  }

  /** Extra checkpoint (after autocannon, after artillery, build end, …). */
  note(): void {
    if (!this.begun) this.begin();
    const s = sampleProcess(this.pid);
    if (s) pushSample(this.acc, s);
  }

  finalize(): ProcessMetrics {
    if (!this.begun) return emptyMetrics();
    this.note();
    const base = finalizeSamples(this.acc);
    const cpuEnd = readCpuSeconds(this.pid);
    const wallSec = (performance.now() - this.wallStarted) / 1000;
    if (this.cpuStarted !== null && cpuEnd !== null && wallSec > 0) {
      const spanAvg = Math.max(0, ((cpuEnd - this.cpuStarted) / wallSec) * 100);
      return {
        ...base,
        avgCpuPct: spanAvg,
        maxCpuPct: Math.max(base.maxCpuPct, spanAvg),
      };
    }
    return base;
  }
}
