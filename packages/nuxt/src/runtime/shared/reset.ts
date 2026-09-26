import { nextTick } from 'vue';
import { applyHostResetLayers, cleanupAll } from '@untestutils/vitest/unit-lifecycle';

const HELPER_MOCK_HOIST = '__NUXT_VITEST_MOCKS';
const HELPER_MOCK_HOIST_FNS = '__NUXT_VITEST_MOCK_FNS';
const HELPER_MOCK_HOIST_ORIGINAL = '__NUXT_VITEST_MOCKS_ORIGINAL';

const BASELINE_ROUTE_PROP = '__UNTESTUTILS_BASELINE_ROUTE__';
const BASELINE_BODY_PROP = '__UNTESTUTILS_BASELINE_BODY__';
const SHARED_RESETS_PROP = '__UNTESTUTILS_SHARED_RESETS__';

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
  __UNTESTUTILS_SHARED_RESETS__?: ResetFn[];
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

/**
 * Register a custom cleanup that runs inside `resetSharedNuxtApp` (worker mode).
 */
export function registerSharedNuxtReset(fn: ResetFn): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = asResetWindow(window);
  const list = (w[SHARED_RESETS_PROP] ??= []);
  list.push(fn);
  return () => {
    const index = list.indexOf(fn);
    if (index !== -1) list.splice(index, 1);
  };
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

  cleanupAll();

  try {
    const importsModule = '#imp' + 'orts';
    const { useRouter, clearError, clearNuxtData, clearNuxtState } = await import(
      /* @vite-ignore */ importsModule
    );
    const baseline = w[BASELINE_ROUTE_PROP] ?? '/';
    const router = useRouter();
    if (router.currentRoute.value.fullPath !== baseline) {
      await router.replace(baseline);
    }
    await clearError();
    clearNuxtData();
    clearNuxtState(undefined, { reset: false });
  } catch {
    /* outside Nuxt env / already torn down */
  }

  const keep = w[BASELINE_BODY_PROP];
  if (keep) {
    for (const child of [...w.document.body.children]) {
      if (!keep.has(child)) child.remove();
    }
  }

  if (opts.endpoints !== false) clearRegisteredEndpoints();
  applyHostResetLayers({
    host: opts.host,
    timers: opts.timers,
    stubs: opts.stubs,
  });
  if (opts.mocks === true) clearNuxtImportMocks();

  for (const fn of [...(w[SHARED_RESETS_PROP] ?? [])]) {
    await fn();
  }
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
