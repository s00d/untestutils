/// <reference path="../../types/nuxt-env.d.ts" />
import { Suspense, defineComponent, h, onErrorCaptured, provide, type VNode } from 'vue';
import { isNuxtError, useNuxtApp, useRoute } from '#imports';
import { PageRouteSymbol } from '#app/components/injections';
import type { NuxtApp, NuxtError } from 'nuxt/app';

type VueError = Parameters<Parameters<typeof onErrorCaptured>[0]>[0];
type VueErrorTarget = Parameters<Parameters<typeof onErrorCaptured>[0]>[1];
type VueErrorInfo = Parameters<Parameters<typeof onErrorCaptured>[0]>[2];
type NuxtErrorWithFlags = NuxtError & {
  fatal?: boolean;
  unhandled?: boolean;
};

/** Log async `vue:error` hook failures without putting `.catch` in the capture callback. */
function reportVueErrorHook(
  nuxtApp: NuxtApp,
  err: VueError,
  target: VueErrorTarget,
  info: VueErrorInfo,
): void {
  const result = nuxtApp.hooks.callHook('vue:error', err, target, info);
  if (result === null || result === undefined || typeof result.then !== 'function') return;
  result.catch((hookError: unknown) => console.error('[nuxt] Error in `vue:error` hook', hookError));
}

function isFatalOrUnhandledNuxtError(err: unknown): err is NuxtErrorWithFlags {
  if (!isNuxtError(err)) return false;
  return ('fatal' in err && Boolean((err as NuxtErrorWithFlags).fatal)) ||
    ('unhandled' in err && Boolean((err as NuxtErrorWithFlags).unhandled));
}

//#region src/runtime/nuxt-root.ts
const nuxt_root_default: ReturnType<typeof defineComponent> = defineComponent({
  setup(_options, { slots }): () => VNode {
    const nuxtApp = useNuxtApp();
    provide(PageRouteSymbol, useRoute());
    const done = nuxtApp.deferHydration();
    const results = nuxtApp.hooks.callHookWith(
      (hooks) => hooks.map((hook) => hook()),
      'vue:setup',
      [],
    );
    if (import.meta.dev && results && results.some((i) => i && 'then' in i))
      console.error('[nuxt] Error in `vue:setup`. Callbacks must be synchronous.');
    onErrorCaptured((err, target, info) => {
      reportVueErrorHook(nuxtApp, err, target, info);
      if (isFatalOrUnhandledNuxtError(err)) return false;
    });
    return () => h(Suspense, { onResolve: done }, slots.default?.());
  },
});
//#endregion
export { nuxt_root_default as default };
