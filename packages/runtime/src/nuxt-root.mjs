import { Suspense, defineComponent, h, onErrorCaptured, provide } from 'vue';
import { isNuxtError, useNuxtApp, useRoute } from '#imports';
import { PageRouteSymbol } from '#app/components/injections';

/** Log async `vue:error` hook failures without putting `.catch` in the capture callback. */
function reportVueErrorHook(nuxtApp, err, target, info) {
  const result = nuxtApp.hooks.callHook('vue:error', err, target, info);
  if (result === null || result === undefined || typeof result.then !== 'function') return;
  result.catch((hookError) => console.error('[nuxt] Error in `vue:error` hook', hookError));
}

//#region src/runtime/nuxt-root.ts
const nuxt_root_default = defineComponent({
  setup(_options, { slots }) {
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
      if (isNuxtError(err) && (err.fatal || err.unhandled)) return false;
    });
    return () => h(Suspense, { onResolve: done }, slots.default?.());
  },
});
//#endregion
export { nuxt_root_default as default };
