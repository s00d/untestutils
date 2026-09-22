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
 * Sum RSS (MB) and max %CPU across `rootPid` and all descendants (ppid walk).
 * Falls back to `sampleProcess(rootPid)` when the process table cannot be read.
 */
export function sampleProcessTree(rootPid: number): ProcessSample | null {
  if (!rootPid || rootPid <= 0) return null;
  if (process.platform === 'win32') return sampleProcess(rootPid);
  try {
    const raw = execSync('ps -axo pid=,ppid=,%cpu=,rss=', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).toString();
    const rows: Array<{ pid: number; ppid: number; cpu: number; rssKb: number }> = [];
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const parts = t.split(/\s+/).map((p) => Number.parseFloat(p));
      if (parts.length < 4) continue;
      const [pid, ppid, cpu, rssKb] = parts;
      if (![pid, ppid, cpu, rssKb].every((n) => Number.isFinite(n))) continue;
      rows.push({ pid: pid!, ppid: ppid!, cpu: cpu!, rssKb: rssKb! });
    }
    if (!rows.some((r) => r.pid === rootPid)) return sampleProcess(rootPid);

    const children = new Map<number, number[]>();
    for (const r of rows) {
      const list = children.get(r.ppid);
      if (list) list.push(r.pid);
      else children.set(r.ppid, [r.pid]);
    }
    const byPid = new Map(rows.map((r) => [r.pid, r]));
    const stack = [rootPid];
    const seen = new Set<number>();
    let rssKb = 0;
    let maxCpu = 0;
    while (stack.length) {
      const pid = stack.pop()!;
      if (seen.has(pid)) continue;
      seen.add(pid);
      const row = byPid.get(pid);
      if (row) {
        rssKb += row.rssKb;
        maxCpu = Math.max(maxCpu, row.cpu);
      }
      const kids = children.get(pid);
      if (kids) stack.push(...kids);
    }
    return { cpu: maxCpu, memoryMb: rssKb / 1024 };
  } catch {
    return sampleProcess(rootPid);
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
 * Each note samples the process **tree** (parent + descendants RSS).
 * Avg CPU over the span uses cumulative parent `cputime` / wall (no timers).
 */
export class ProcessSampler {
  private readonly acc = createSampleAccumulator();
  private wallStarted = performance.now();
  private cpuStarted: number | null = null;
  private begun = false;
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly pid: number) {}

  /** First checkpoint (ready / build start). Starts a light mid-phase poll. */
  begin(): void {
    this.begun = true;
    this.wallStarted = performance.now();
    this.cpuStarted = readCpuSeconds(this.pid);
    this.note();
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => this.note(), 250);
      // Don't keep the process alive solely for polling
      this.pollTimer.unref?.();
    }
  }

  /** Extra checkpoint (after autocannon, after artillery, build end, …). */
  note(): void {
    if (!this.begun) this.begin();
    const s = sampleProcessTree(this.pid);
    if (s) pushSample(this.acc, s);
  }

  finalize(): ProcessMetrics {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
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
