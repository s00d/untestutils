export type AppIsolation = 'file' | 'worker';

export type WorkerIsolationDefaultsInput = {
  /** User-provided Vitest `test.isolate` (undefined = unset). */
  userIsolate?: boolean;
  appIsolation?: AppIsolation;
  resetBetweenTests?: boolean;
  /** Label in warn messages (e.g. `nuxt`). */
  label?: string;
};

export type WorkerIsolationDefaultsResult = {
  appIsolation: AppIsolation;
  resetBetweenTests?: boolean;
  /** When set, apply to resolved Vitest config `test.isolate`. */
  isolate?: boolean;
};

const WORKER_ISOLATE_WARNED = Symbol.for('@untestutils/vitest:worker-isolate-warned');
const FILE_NO_ISOLATE_WARNED = Symbol.for('@untestutils/vitest:file-no-isolate-warned');

/**
 * Framework-agnostic defaults for `appIsolation: 'worker'`:
 * auto `isolate: false` + `resetBetweenTests: true`, with one-shot warns.
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
