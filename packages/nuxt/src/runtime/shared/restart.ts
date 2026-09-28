import {
  tryUseNuxtAppFromUnctx,
  disposeSharedNuxtApp,
  type SetupEntryWindow,
} from './setup-entry';
import { setupNuxt } from './nuxt';
import {
  awaitPendingDispose,
  cleanupAll,
  invalidateWorkerSetup,
} from '@untestutils/vitest/unit-lifecycle';

const HOT_ENABLED = '__UNTESTUTILS_HOT_RESTART__';

type HotWindow = SetupEntryWindow & {
  __UNTESTUTILS_HOT_RESTART__?: boolean;
  __UNTESTUTILS_BASELINE_ROUTE__?: string;
  __UNTESTUTILS_BASELINE_BODY__?: Set<Element>;
};

/**
 * Tear down the shared Nuxt app and boot a fresh one (watch / recovery).
 * Safe after failed boots: dispose is best-effort and never blocks retry.
 */
export async function restartSharedNuxtApp(
  win: SetupEntryWindow = globalThis.window as SetupEntryWindow,
): Promise<void> {
  await awaitPendingDispose(win);
  try {
    cleanupAll();
  } catch {
    /* ignore — dispose below still runs */
  }
  await disposeSharedNuxtApp(tryUseNuxtAppFromUnctx);
  invalidateWorkerSetup(win);
  (
    globalThis as { __UNTESTUTILS_FORCE_NUXT_REMOUNT__?: boolean }
  ).__UNTESTUTILS_FORCE_NUXT_REMOUNT__ = true;
  await setupNuxt();
}

/**
 * Invalidate worker memoization on Vite HMR / full reload so the next file reboots Nuxt.
 * Idempotent; safe to call from entry when `appIsolation: 'worker'`.
 */
export function enableSharedNuxtHotRestart(
  win: SetupEntryWindow = globalThis.window as SetupEntryWindow,
  hot: { on: (event: string, cb: () => void) => void } | undefined = (
    import.meta as { hot?: { on: (event: string, cb: () => void) => void } }
  ).hot,
): void {
  const w = win as HotWindow;
  if (w[HOT_ENABLED]) return;
  w[HOT_ENABLED] = true;

  if (!hot) return;

  const invalidate = (): void => {
    // Chain disposes — do not drop an in-flight promise on rapid HMR.
    // Next boot awaits __UNTESTUTILS_PENDING_DISPOSE__ before setup.
    const prev = w.__UNTESTUTILS_PENDING_DISPOSE__;
    w.__UNTESTUTILS_PENDING_DISPOSE__ = Promise.resolve(prev)
      .catch(() => undefined)
      .then(() => disposeSharedNuxtApp(tryUseNuxtAppFromUnctx))
      .catch(() => undefined);
    invalidateWorkerSetup(w);
  };

  hot.on('vite:beforeFullReload', invalidate);
  hot.on('vite:beforeUpdate', invalidate);
}
