import { execSync } from 'node:child_process';
import type { ProcessMetrics } from './types';

export type ProcessSample = { cpu: number; memoryMb: number };

/** Sample CPU% and RSS (MB) for a PID via `ps` (Unix). Returns null if gone. */
export function sampleProcess(pid: number): ProcessSample | null {
  if (!pid || pid <= 0) return null;
  try {
    const result = execSync(`ps -p ${pid} -o %cpu,rss`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).toString();
    const lines = result.trim().split('\n');
    if (lines.length < 2 || !lines[1]?.trim()) return null;
    const parts = lines[1]!.trim().split(/\s+/).map(Number.parseFloat);
    return {
      cpu: parts[0] || 0,
      memoryMb: parts[1] ? parts[1]! / 1024 : 0,
    };
  } catch {
    return null;
  }
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

/** Poll `sampleProcess` until stopped. */
export function startProcessMonitor(
  pid: number,
  intervalMs = 1000,
  onSample?: (s: ProcessSample) => void,
): { acc: SampleAccumulator; stop: () => void } {
  const acc = createSampleAccumulator();
  const timer = setInterval(() => {
    const s = sampleProcess(pid);
    if (!s) return;
    pushSample(acc, s);
    onSample?.(s);
  }, intervalMs);
  return {
    acc,
    stop: () => clearInterval(timer),
  };
}
