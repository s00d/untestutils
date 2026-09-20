import type { PerfSuite, PerfTargetResult, ProcessMetrics } from './types';

export type PerfVerbosity = 'quiet' | 'default' | 'verbose';

export type PerfUiPhase = 'build' | 'start' | 'autocannon' | 'artillery' | 'done';

export type PerfUiEvent =
  | { type: 'suiteStart'; suite: PerfSuite; runs: number; skipLoad: boolean }
  | { type: 'targetStart'; id: string; label: string; run: number; runs: number }
  | { type: 'phase'; phase: PerfUiPhase; detail?: string }
  | { type: 'log'; channel: 'build' | 'server' | 'warn'; line: string }
  | { type: 'targetResult'; result: PerfTargetResult }
  | { type: 'suiteEnd'; results: PerfTargetResult[]; runs: number };

export type PerfUi = {
  verbosity: PerfVerbosity;
  setVerbosity: (v: PerfVerbosity) => void;
  on: (listener: (e: PerfUiEvent) => void) => () => void;
  emit: (e: PerfUiEvent) => void;
};

export function createPerfUi(verbosity: PerfVerbosity = 'default'): PerfUi {
  let level: PerfVerbosity = verbosity;
  const listeners = new Set<(e: PerfUiEvent) => void>();
  return {
    get verbosity() {
      return level;
    },
    setVerbosity(v) {
      level = v;
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(e) {
      for (const fn of listeners) fn(e);
    },
  };
}

/**
 * True when sampler produced a signal worth printing.
 * Sub-1MB / sub-1% noise would display as `0` — treat as empty.
 */
export function hasUsefulProcessMetrics(m: ProcessMetrics): boolean {
  return (
    m.maxMemoryMb >= 1 ||
    m.avgMemoryMb >= 1 ||
    m.maxCpuPct >= 1 ||
    m.avgCpuPct >= 1
  );
}

export type HarnessOpts = {
  ui?: PerfUi;
};
