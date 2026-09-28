import {
  disposeBestEffort,
  registerSetupEntry,
  resolveAppIsolation as resolveGenericAppIsolation,
  invalidateWorkerSetup,
  type AppIsolation,
  type DisposableApp,
  type SetupEntryWindow as GenericSetupEntryWindow,
} from '@untestutils/vitest/unit-lifecycle';

const vtuModule = await import('@vue/test-utils').catch(() => null);

export type NuxtAppIsolation = AppIsolation;

export type SetupEntryWindow = GenericSetupEntryWindow & {
  __NUXT_VITEST_ENVIRONMENT__?: boolean;
  __NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__?: boolean;
};

export type NuxtAppLike = DisposableApp;

export type RegisterNuxtSetupEntryOptions = {
  mode: NuxtAppIsolation;
  resetBetweenTests: boolean;
  window: SetupEntryWindow;
  setupNuxt: () => Promise<void>;
  tryUseNuxtApp: () => NuxtAppLike;
  resetSharedNuxtApp?: () => void | Promise<void>;
  vi: { resetModules: () => void };
  beforeAll: (fn: () => void | Promise<void>) => void;
  afterEach?: (fn: () => void | Promise<void>) => void;
  beforeEach?: (fn: () => void | Promise<void>) => void;
  onTestFinished?: (fn: () => void | Promise<void>) => void;
  /**
   * When true, run even if `__NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__` is set
   * (used by browser-entry itself). Node `entry` leaves this false so it skips.
   */
  fromBrowserEntry?: boolean;
};

export function tryUseNuxtAppFromUnctx(): NuxtAppLike {
  try {
    const unctx = (
      globalThis as {
        __unctx__?: { get: (id: string) => { tryUse: () => NuxtAppLike } };
      }
    ).__unctx__;
    return unctx?.get('nuxt-app')?.tryUse() ?? null;
  } catch {
    return null;
  }
}

/**
 * Best-effort dispose of a live Nuxt app on a shared window (file remount, failed boot, restart).
 * Never throws — callers must remain able to clear memo / retry.
 */
export async function disposeSharedNuxtApp(tryUseNuxtApp: () => NuxtAppLike): Promise<void> {
  await disposeBestEffort(tryUseNuxtApp, { rootId: 'nuxt-test', unctxId: 'nuxt-app' });
}

/**
 * Registers Vitest hooks for Nuxt unit boot. Thin adapter over generic unit-lifecycle.
 */
export function registerNuxtSetupEntry(options: RegisterNuxtSetupEntryOptions): void {
  const {
    mode,
    resetBetweenTests,
    window: win,
    setupNuxt,
    tryUseNuxtApp,
    resetSharedNuxtApp,
    vi,
    beforeAll,
    afterEach,
    beforeEach,
    onTestFinished,
    fromBrowserEntry = false,
  } = options;

  const enabled =
    win.__NUXT_VITEST_ENVIRONMENT__ === true &&
    !(win.__NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__ && !fromBrowserEntry);

  registerSetupEntry({
    mode,
    resetBetweenTests,
    window: win,
    setup: setupNuxt,
    tryUseApp: tryUseNuxtApp,
    dispose: disposeSharedNuxtApp,
    reset: resetSharedNuxtApp,
    vi,
    beforeAll,
    afterEach,
    beforeEach,
    onTestFinished,
    enabled,
    resetFailureMessage: '[untestutils] resetSharedNuxtApp failed; disposing shared app',
  });

  if (enabled && mode === 'worker' && resetBetweenTests) {
    enableVtuAutoUnmount({ beforeEach, afterEach, onTestFinished });
  }
}

/** Unmount plain VTU `mount()` wrappers between tests. Nuxt owns this — not generic lifecycle. */
function enableVtuAutoUnmount(hooks: {
  beforeEach?: (fn: () => void | Promise<void>) => void;
  afterEach?: (fn: () => void | Promise<void>) => void;
  onTestFinished?: (fn: () => void | Promise<void>) => void;
}): void {
  if (!vtuModule?.enableAutoUnmount) return;

  let schedule: ((fn: () => void) => void) | undefined;
  if (hooks.onTestFinished && hooks.beforeEach) {
    schedule = (fn) => {
      hooks.beforeEach!(() => {
        hooks.onTestFinished!(fn);
      });
    };
  } else if (hooks.afterEach) {
    schedule = hooks.afterEach as (fn: () => void) => void;
  }
  if (!schedule) return;
  vtuModule.disableAutoUnmount?.();
  vtuModule.enableAutoUnmount(schedule);
}

export function resolveAppIsolation(
  options: { nuxt?: { appIsolation?: NuxtAppIsolation; resetBetweenTests?: boolean } } | undefined,
  win: SetupEntryWindow,
): { mode: NuxtAppIsolation; resetBetweenTests: boolean } {
  return resolveGenericAppIsolation(
    {
      appIsolation: options?.nuxt?.appIsolation,
      resetBetweenTests: options?.nuxt?.resetBetweenTests,
    },
    win,
  );
}

/** @deprecated Prefer `invalidateWorkerSetup` from `@untestutils/vitest/unit-lifecycle`. */
export function invalidateWorkerNuxtSetup(
  win: SetupEntryWindow = window as SetupEntryWindow,
): void {
  invalidateWorkerSetup(win);
}
