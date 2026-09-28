import { nextTick } from 'vue';
import {
  applyHostResetLayers,
  cleanupAll,
  registerSharedReset,
  runSharedResets,
} from '@untestutils/vitest/unit-lifecycle';
import { clearNuxtImportOverrides } from './overrides';

const HELPER_MOCK_HOIST = '__NUXT_VITEST_MOCKS';
const HELPER_MOCK_HOIST_FNS = '__NUXT_VITEST_MOCK_FNS';
const HELPER_MOCK_HOIST_ORIGINAL = '__NUXT_VITEST_MOCKS_ORIGINAL';

const BASELINE_ROUTE_PROP = '__UNTESTUTILS_BASELINE_ROUTE__';
const BASELINE_BODY_PROP = '__UNTESTUTILS_BASELINE_BODY__';

type ResetFn = () => void | Promise<void>;

type ResetWindow = Window & {
  __NUXT__?: {
    data?: Record<string, unknown>;
    state?: Record<string, unknown>;
  };
  __registry?: Set<string>;
  __app?: {
    _registeredEndpointRegistry?: Record<string, unknown[]>;
  };
  __UNTESTUTILS_BASELINE_ROUTE__?: string;
  __UNTESTUTILS_BASELINE_BODY__?: Set<Element>;
};

type MockEntry = Record<string, unknown> & {
  [HELPER_MOCK_HOIST_ORIGINAL]?: Record<string, unknown>;
};

type MockRegistry = Record<string, MockEntry>;
type MockFns = Record<string, Record<string, unknown>>;

export type ResetSharedNuxtAppOptions = {
  /** Clear `registerEndpoint` handlers. Default `true`. */
  endpoints?: boolean;
  /** Restore / clear `mockNuxtImport` registry. Default `false`. */
  mocks?: boolean;
  /** Clear cookies + localStorage + sessionStorage. Default `true`. */
  host?: boolean;
  /** `vi.clearAllTimers` + `useRealTimers`. Default `true`. */
  timers?: boolean;
  /** `vi.unstubAllEnvs` / `unstubAllGlobals`. Default `true`. */
  stubs?: boolean;
};

function asResetWindow(win: Window): ResetWindow {
  return win as unknown as ResetWindow;
}

/**
 * Snapshot route + body children right after the first successful `setupNuxt` in worker mode.
 */
export function captureSharedNuxtBaseline(
  baselineRoute?: string,
  win: Window = typeof window !== 'undefined' ? window : (undefined as unknown as Window),
): void {
  if (!win) return;
  const w = asResetWindow(win);
  if (baselineRoute !== undefined) w[BASELINE_ROUTE_PROP] ??= baselineRoute;
  w[BASELINE_BODY_PROP] ??= new Set([...w.document.body.children]);
}

let unkeyedResetCounter = 0;

/**
 * Register a custom cleanup that runs inside `resetSharedNuxtApp` (worker mode).
 * Prefer `registerSharedNuxtReset(key, fn)` so setupFile re-evals replace in place.
 * Unkeyed `(fn)` gets a unique auto-key (legacy; can accumulate across re-evals).
 */
export function registerSharedNuxtReset(fn: ResetFn): () => void;
export function registerSharedNuxtReset(key: string, fn: ResetFn): () => void;
export function registerSharedNuxtReset(keyOrFn: string | ResetFn, maybeFn?: ResetFn): () => void {
  if (typeof keyOrFn === 'function') {
    const key = `__unkeyed_${++unkeyedResetCounter}`;
    return registerSharedReset(key, keyOrFn);
  }
  return registerSharedReset(keyOrFn, maybeFn!);
}

/**
 * Soft-reset shared Nuxt app state between tests when `appIsolation: 'worker'`.
 * By default also clears cookies/storage, fake timers, and Vitest stubs.
 * Does not clear `mockNuxtImport` unless `{ mocks: true }`.
 */
export async function resetSharedNuxtApp(opts: ResetSharedNuxtAppOptions = {}): Promise<void> {
  if (typeof window === 'undefined') return;
  const w = asResetWindow(window);
  await nextTick();
  await Promise.resolve();
  await Promise.resolve();

  let layerError: unknown;
  try {
    cleanupAll();
  } catch (error) {
    layerError = error;
  }

  try {
    const importsModule = '#imp' + 'orts';
    const { useRouter, clearError, clearNuxtData, clearNuxtState } = await import(
      /* @vite-ignore */ importsModule
    );
    const baseline = w[BASELINE_ROUTE_PROP] ?? '/';
    const router = useRouter();
    // Live Nuxt: route + clear failures are real (do not swallow).
    try {
      if (router.currentRoute.value.fullPath !== baseline) {
        await router.replace(baseline);
      }
      if (router.currentRoute.value.fullPath !== baseline) {
        throw new Error(
          `[untestutils] resetSharedNuxtApp: route restore failed (expected ${baseline}, got ${router.currentRoute.value.fullPath})`,
        );
      }
      await clearError();
      clearNuxtData();
      clearNuxtState(undefined, { reset: false });
    } catch (error) {
      if (layerError === undefined) layerError = error;
      else {
        layerError = new AggregateError(
          [layerError, error],
          '[untestutils] resetSharedNuxtApp: multiple layer failures',
        );
      }
    }
  } catch {
    /* Import / useRouter failure → outside Nuxt env / already torn down */
  }

  const keep = w[BASELINE_BODY_PROP];
  if (keep) {
    for (const child of [...w.document.body.children]) {
      if (!keep.has(child)) child.remove();
    }
  }

  if (opts.endpoints !== false) clearRegisteredEndpoints();
  await applyHostResetLayers({
    host: opts.host,
    timers: opts.timers,
    stubs: opts.stubs,
  });
  if (opts.mocks === true) clearNuxtImportMocks();
  clearNuxtImportOverrides(w);

  try {
    await runSharedResets(w);
  } catch (error) {
    if (layerError === undefined) layerError = error;
    else {
      layerError = new AggregateError(
        [layerError, error],
        '[untestutils] resetSharedNuxtApp: multiple layer failures',
      );
    }
  }

  if (layerError !== undefined) throw layerError;
}

/**
 * Restore `mockNuxtImport` live values from originals and clear pending factories.
 */
export function clearNuxtImportMocks(): void {
  const g = globalThis as typeof globalThis & {
    [HELPER_MOCK_HOIST]?: MockRegistry;
    [HELPER_MOCK_HOIST_FNS]?: MockFns;
  };
  const mocks = g[HELPER_MOCK_HOIST];
  if (mocks) {
    for (const entry of Object.values(mocks)) {
      const originals = entry[HELPER_MOCK_HOIST_ORIGINAL];
      if (!originals) continue;
      for (const [name, value] of Object.entries(originals)) {
        entry[name] = value;
      }
    }
  }
  g[HELPER_MOCK_HOIST_FNS] = {};
}

/**
 * Remove all handlers registered via `registerEndpoint` in the current window.
 */
export function clearRegisteredEndpoints(): void {
  if (typeof window === 'undefined') return;
  const w = asResetWindow(window);
  const app = w.__app;
  if (app?._registeredEndpointRegistry) {
    for (const key of Object.keys(app._registeredEndpointRegistry)) {
      delete app._registeredEndpointRegistry[key];
    }
  }
  w.__registry?.clear();
}
