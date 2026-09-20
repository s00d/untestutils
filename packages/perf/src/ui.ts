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

/** True when sampler produced a non-zero signal worth printing. */
export function hasUsefulProcessMetrics(m: ProcessMetrics): boolean {
  return m.maxMemoryMb > 0 || m.avgMemoryMb > 0 || m.maxCpuPct > 0 || m.avgCpuPct > 0;
}

export type HarnessOpts = {
  ui?: PerfUi;
};
