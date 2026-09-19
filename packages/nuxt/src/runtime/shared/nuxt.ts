/// <reference path="../../../types/nuxt-env.d.ts" />
import { getVueWrapperPlugin } from './vue-wrapper-plugin';
import type { NuxtApp } from 'nuxt/app';

type NuxtAppWithRouteSync = NuxtApp & {
  _route: NuxtApp['_route'] & { sync?: () => void };
};

/** Boots Nuxt app entry inside the Vitest unit environment (Nuxt virtuals only resolve there). */
export async function setupNuxt(): Promise<void> {
  const { useRouter, useNuxtApp } = await import('#imports');
  await import('#app/nuxt-vitest-app-entry').then((r: { default: () => Promise<void> | void }) =>
    r.default(),
  );
  const nuxtApp = useNuxtApp() as NuxtAppWithRouteSync;
  function sync(): Promise<void> | void {
    return nuxtApp._route.sync ? nuxtApp._route.sync() : nuxtApp.callHook('page:finish');
  }
  const { hasNuxtPage } = getVueWrapperPlugin();
  useRouter().afterEach(() => {
    if (hasNuxtPage()) return;
    return sync();
  });
  return sync();
}
