export type AppIsolation = 'file' | 'worker';

/** @deprecated Prefer literal `'__UNTESTUTILS_WORKER_SETUP__'` / typed `SetupEntryWindow`. */
export const WORKER_SETUP_PROP = '__UNTESTUTILS_WORKER_SETUP__' as const;
/** @deprecated Unused — reset hooks re-register every setupFile eval. */
export const WORKER_RESET_HOOK_PROP = '__UNTESTUTILS_WORKER_RESET_HOOK__' as const;

export type SetupEntryWindow = Window & {
  __UNTESTUTILS_ENVIRONMENT__?: boolean;
  __UNTESTUTILS_APP_ISOLATION__?: AppIsolation;
  __UNTESTUTILS_RESET_BETWEEN_TESTS__?: boolean;
  __UNTESTUTILS_WORKER_SETUP__?: Promise<void>;
  /** In-flight dispose from HMR invalidate — next boot must await before setup. */
  __UNTESTUTILS_PENDING_DISPOSE__?: Promise<void>;
  /** Set when soft-reset failed and disposed — next test must `restartSharedApp()`. */
  __UNTESTUTILS_NEEDS_RESTART__?: boolean;
  __UNTESTUTILS_BASELINE_ROUTE__?: string;
  __UNTESTUTILS_BASELINE_BODY__?: Set<Element>;
};

export type DisposableApp =
  | {
      vueApp?: { unmount: () => void };
      _scope?: { stop?: () => void };
    }
  | null
  | undefined;

export type RegisterSetupEntryOptions = {
  mode: AppIsolation;
  resetBetweenTests: boolean;
  window: SetupEntryWindow;
  setup: () => Promise<void>;
  tryUseApp: () => DisposableApp;
  dispose?: (tryUseApp: () => DisposableApp) => void | Promise<void>;
  reset?: () => void | Promise<void>;
  vi: { resetModules: () => void };
  beforeAll: (fn: () => void | Promise<void>) => void;
  afterEach?: (fn: () => void | Promise<void>) => void;
  beforeEach?: (fn: () => void | Promise<void>) => void;
  /**
   * Prefer for soft-reset: runs after project `afterEach`, even when those fail.
   * Falls back to `afterEach` when omitted.
   */
  onTestFinished?: (fn: () => void | Promise<void>) => void;
  /**
   * When false, registration is a no-op.
   * Default: `window.__UNTESTUTILS_ENVIRONMENT__ === true`.
   */
  enabled?: boolean;
  /** Warning logged when soft-reset throws (before dispose + memo clear). */
  resetFailureMessage?: string;
};

/**
 * Best-effort dispose of a live app on a shared window.
 * Never throws — callers must remain able to clear memo / retry.
 */
export async function disposeBestEffort(
  tryUseApp: () => DisposableApp,
  opts: { rootId?: string; unctxId?: string } = {},
): Promise<void> {
  const existing = tryUseApp();
  if (existing) {
    try {
      existing._scope?.stop?.();
    } catch {
      /* ignore */
    }
    try {
      existing.vueApp?.unmount();
    } catch {
      /* ignore */
    }
  }
  if (opts.unctxId) {
    try {
      const unctx = (
        globalThis as {
          __unctx__?: { unset?: (id: string) => void };
        }
      ).__unctx__;
      unctx?.unset?.(opts.unctxId);
    } catch {
      /* ignore */
    }
  }
  if (opts.rootId) {
    try {
      const root = typeof document !== 'undefined' ? document.getElementById(opts.rootId) : null;
      if (root) root.innerHTML = '';
    } catch {
      /* ignore */
    }
  }
}

/**
 * Registers Vitest hooks for in-process unit app boot (framework-agnostic).
 */
export function registerSetupEntry(options: RegisterSetupEntryOptions): void {
  const {
    mode,
    resetBetweenTests,
    window: win,
    setup,
    tryUseApp,
    dispose = (fn) => disposeBestEffort(fn),
    reset,
    vi,
    beforeAll,
    afterEach,
    beforeEach,
    onTestFinished,
    enabled = win.__UNTESTUTILS_ENVIRONMENT__ === true,
    resetFailureMessage = '[untestutils] shared reset failed; disposing shared app',
  } = options;

  if (!enabled) return;

  if (mode === 'worker') {
    if (!tryUseApp()) vi.resetModules();
  } else {
    vi.resetModules();
  }

  if (mode === 'worker' && beforeEach) {
    beforeEach(() => {
      if (win.__UNTESTUTILS_NEEDS_RESTART__) {
        throw new Error(
          '[untestutils] shared app was disposed after reset failure; call restartSharedApp() before the next test',
        );
      }
    });
  }

  beforeAll(async () => {
    if (mode !== 'worker') {
      await dispose(tryUseApp);
      await setup();
      return;
    }

    await awaitPendingDispose(win);

    win.__UNTESTUTILS_WORKER_SETUP__ ??= setup().catch(async (error: unknown) => {
      await dispose(tryUseApp);
      delete win.__UNTESTUTILS_WORKER_SETUP__;
      throw error;
    });

    await win.__UNTESTUTILS_WORKER_SETUP__;
  });

  // Re-register every setupFile eval — Vitest clears suite hooks per file.
  // Prefer onTestFinished (via beforeEach) so project afterEach failures cannot skip reset.
  // onTestFinished() may only be called inside a test — schedule it from beforeEach.
  if (mode === 'worker' && resetBetweenTests && reset) {
    const runReset = async (): Promise<void> => {
      try {
        await reset();
      } catch (error) {
        console.warn(resetFailureMessage, error);
        await dispose(tryUseApp);
        delete win.__UNTESTUTILS_WORKER_SETUP__;
        win.__UNTESTUTILS_NEEDS_RESTART__ = true;
        throw new Error(`${resetFailureMessage}; call restartSharedApp() before the next test`, {
          cause: error,
        });
      }
    };

    if (onTestFinished && beforeEach) {
      beforeEach(() => {
        onTestFinished(runReset);
      });
    } else if (afterEach) {
      afterEach(runReset);
    }
  }
}

export function resolveAppIsolation(
  options: { appIsolation?: AppIsolation; resetBetweenTests?: boolean } | undefined,
  win: SetupEntryWindow,
): { mode: AppIsolation; resetBetweenTests: boolean } {
  const mode = options?.appIsolation ?? win.__UNTESTUTILS_APP_ISOLATION__ ?? ('file' as const);
  const resetBetweenTests =
    options?.resetBetweenTests ?? win.__UNTESTUTILS_RESET_BETWEEN_TESTS__ ?? mode === 'worker';
  return { mode, resetBetweenTests };
}

/** Clear worker memoization so the next boot runs setup again (watch / restart). */
export function invalidateWorkerSetup(win: SetupEntryWindow = window as SetupEntryWindow): void {
  delete win.__UNTESTUTILS_WORKER_SETUP__;
  delete win.__UNTESTUTILS_NEEDS_RESTART__;
  delete win.__UNTESTUTILS_BASELINE_ROUTE__;
  delete win.__UNTESTUTILS_BASELINE_BODY__;
}

/**
 * Drain HMR dispose chain. Compare-and-swap delete so a concurrent invalidate
 * that replaces the slot during await is not dropped.
 */
export async function awaitPendingDispose(win: SetupEntryWindow): Promise<void> {
  while (win.__UNTESTUTILS_PENDING_DISPOSE__) {
    const pending = win.__UNTESTUTILS_PENDING_DISPOSE__;
    await pending;
    if (win.__UNTESTUTILS_PENDING_DISPOSE__ === pending) {
      delete win.__UNTESTUTILS_PENDING_DISPOSE__;
    }
  }
}
