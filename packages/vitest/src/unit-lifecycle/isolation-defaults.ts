export type AppIsolation = 'file' | 'worker';

export type WorkerIsolationDefaultsInput = {
  /** User-provided Vitest `test.isolate` (undefined = unset). */
  userIsolate?: boolean;
  /** User-provided Vitest `test.maxConcurrency` (undefined = unset). */
  userMaxConcurrency?: number;
  appIsolation?: AppIsolation;
  resetBetweenTests?: boolean;
  /** Vitest pool name when known (e.g. `vmThreads`). */
  pool?: string;
  /** `test.sequence.hooks` when known. */
  sequenceHooks?: string;
  /** `test.sequence.setupFiles` when known. */
  sequenceSetupFiles?: string;
  /** Label in warn messages (e.g. `nuxt`). */
  label?: string;
};

export type WorkerIsolationDefaultsResult = {
  appIsolation: AppIsolation;
  resetBetweenTests?: boolean;
  /** When set, apply to resolved Vitest config `test.isolate`. */
  isolate?: boolean;
  /** When set, apply to resolved Vitest config `test.maxConcurrency`. */
  maxConcurrency?: number;
};

const WORKER_ISOLATE_WARNED = Symbol.for('@untestutils/vitest:worker-isolate-warned');
const FILE_NO_ISOLATE_WARNED = Symbol.for('@untestutils/vitest:file-no-isolate-warned');
const WORKER_CONCURRENCY_WARNED = Symbol.for('@untestutils/vitest:worker-concurrency-warned');
const WORKER_SEQUENCE_WARNED = Symbol.for('@untestutils/vitest:worker-sequence-warned');
const WORKER_POOL_WARNED = Symbol.for('@untestutils/vitest:worker-pool-warned');

/**
 * Framework-agnostic defaults for `appIsolation: 'worker'`:
 * auto `isolate: false` + `resetBetweenTests: true` + `maxConcurrency: 1`, with one-shot warns.
 */
export function applyWorkerIsolationDefaults(
  input: WorkerIsolationDefaultsInput,
): WorkerIsolationDefaultsResult {
  const label = input.label ?? 'untestutils';
  const appIsolation = input.appIsolation ?? 'file';
  const result: WorkerIsolationDefaultsResult = { appIsolation };

  if (appIsolation === 'file' && input.userIsolate === false) {
    const g = globalThis as typeof globalThis & { [FILE_NO_ISOLATE_WARNED]?: boolean };
    if (!g[FILE_NO_ISOLATE_WARNED]) {
      g[FILE_NO_ISOLATE_WARNED] = true;
      console.warn(
        `[untestutils] appIsolation: "file" with isolate: false — each file remounts the app on a shared window (slower). Prefer appIsolation: "worker" for shared-app reuse, or leave isolate at the Vitest default. (${label})`,
      );
    }
  }

  if (appIsolation !== 'worker') return result;

  if (input.resetBetweenTests === undefined) result.resetBetweenTests = true;
  else result.resetBetweenTests = input.resetBetweenTests;

  if (input.userMaxConcurrency === undefined) {
    result.maxConcurrency = 1;
  } else if (input.userMaxConcurrency > 1) {
    const g = globalThis as typeof globalThis & { [WORKER_CONCURRENCY_WARNED]?: boolean };
    if (!g[WORKER_CONCURRENCY_WARNED]) {
      g[WORKER_CONCURRENCY_WARNED] = true;
      console.warn(
        `[untestutils] appIsolation: "worker" with maxConcurrency: ${input.userMaxConcurrency} — concurrent tests share one app and can race soft-reset. Prefer maxConcurrency: 1. (${label})`,
      );
    }
  }

  if (input.sequenceHooks === 'parallel' || input.sequenceSetupFiles === 'parallel') {
    const g = globalThis as typeof globalThis & { [WORKER_SEQUENCE_WARNED]?: boolean };
    if (!g[WORKER_SEQUENCE_WARNED]) {
      g[WORKER_SEQUENCE_WARNED] = true;
      console.warn(
        `[untestutils] appIsolation: "worker" with sequence.hooks/setupFiles: "parallel" is unsupported — shared-app setup/reset must stay sequential. (${label})`,
      );
    }
  }

  if (input.pool === 'vmThreads' || input.pool === 'vmForks') {
    const g = globalThis as typeof globalThis & { [WORKER_POOL_WARNED]?: boolean };
    if (!g[WORKER_POOL_WARNED]) {
      g[WORKER_POOL_WARNED] = true;
      console.warn(
        `[untestutils] appIsolation: "worker" with pool: "${input.pool}" — isolate has no effect in VM pools; prefer threads/forks. (${label})`,
      );
    }
  }

  if (input.userIsolate === undefined) {
    result.isolate = false;
    return result;
  }
  if (input.userIsolate !== true) return result;

  const g = globalThis as typeof globalThis & { [WORKER_ISOLATE_WARNED]?: boolean };
  if (!g[WORKER_ISOLATE_WARNED]) {
    g[WORKER_ISOLATE_WARNED] = true;
    console.warn(
      `[untestutils] appIsolation: "worker" with isolate: true — the app will not be reused across files because Vitest tears down the environment per file. Set isolate: false to enable worker-scoped reuse. (${label})`,
    );
  }
  return result;
}
