import { getVueWrapperPlugin } from './vue-wrapper-plugin';
import { captureSharedNuxtBaseline } from './reset';
import { disposeSharedNuxtApp, tryUseNuxtAppFromUnctx } from './setup-entry';
import { bumpUnitBootCounter } from '@untestutils/vitest/unit-lifecycle';
import type { NuxtApp } from 'nuxt/app';

type NuxtAppWithRouteSync = NuxtApp & {
  _route: NuxtApp['_route'] & { sync?: () => void };
  _scope?: { stop?: () => void; active?: boolean };
};

type NuxtImports = {
  useRouter: () => {
    currentRoute: { value: { fullPath: string } };
    afterEach: (guard: () => Promise<void> | void) => unknown;
  };
  useNuxtApp: () => NuxtAppWithRouteSync;
  tryUseNuxtApp?: () => NuxtAppWithRouteSync | null | undefined;
};

function syncRoute(nuxtApp: NuxtAppWithRouteSync): Promise<void> | void {
  return nuxtApp._route.sync ? nuxtApp._route.sync() : nuxtApp.callHook('page:finish');
}

function isWorkerIsolation(): boolean {
  const win = globalThis.window as { __UNTESTUTILS_APP_ISOLATION__?: string } | undefined;
  return win?.__UNTESTUTILS_APP_ISOLATION__ === 'worker';
}

function forceNuxtEntryRemount(): void {
  (
    globalThis as { __UNTESTUTILS_FORCE_NUXT_REMOUNT__?: boolean }
  ).__UNTESTUTILS_FORCE_NUXT_REMOUNT__ = true;
}

async function callNuxtAppEntry(): Promise<void> {
  await import(/* @vite-ignore */ '#app/nuxt-vitest-app-entry').then(
    (r: { default: () => Promise<void> | void }) => r.default(),
  );
}

/** Boots Nuxt app entry inside the Vitest unit environment (Nuxt virtuals only resolve there). */
export async function setupNuxt(): Promise<void> {
  const { useRouter, useNuxtApp, tryUseNuxtApp } = (await import(
    /* @vite-ignore */ '#imp' + 'orts'
  )) as NuxtImports;

  const existing = tryUseNuxtApp?.() ?? null;
  const forceRemount = !!(globalThis as { __UNTESTUTILS_FORCE_NUXT_REMOUNT__?: boolean })
    .__UNTESTUTILS_FORCE_NUXT_REMOUNT__;
  // Worker mode reuses the live app unless an explicit remount was requested.
  if (existing && isWorkerIsolation() && !forceRemount) {
    captureSharedNuxtBaseline(useRouter().currentRoute.value.fullPath);
    return syncRoute(existing);
  }

  // File / remount path on a shared window (isolate:false).
  await disposeSharedNuxtApp(() => existing ?? tryUseNuxtAppFromUnctx());
  if (!isWorkerIsolation()) forceNuxtEntryRemount();

  await callNuxtAppEntry();
  bumpUnitBootCounter();
  const nuxtApp = useNuxtApp();
  function sync(): Promise<void> | void {
    return syncRoute(nuxtApp);
  }
  const { hasNuxtPage } = getVueWrapperPlugin();
  useRouter().afterEach(() => {
    if (hasNuxtPage()) return;
    return sync();
  });
  captureSharedNuxtBaseline(useRouter().currentRoute.value.fullPath);
  return sync();
}
