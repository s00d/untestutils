/** Ambient types for Nuxt virtual modules (resolved only inside the unit test environment). */
declare module '#imports' {
  export const defineComponent: typeof import('vue').defineComponent;
  export const tryUseNuxtApp: typeof import('nuxt/app').tryUseNuxtApp;
  export const useNuxtApp: typeof import('nuxt/app').useNuxtApp;
  export const useRouter: typeof import('vue-router').useRouter;
  export const useRoute: typeof import('vue-router').useRoute;
  export const isNuxtError: typeof import('nuxt/app').isNuxtError;
}

declare module '#app/composables/router' {
  export const useRouter: typeof import('vue-router').useRouter;
}

declare module '#app/nuxt-vitest-app-entry' {
  const setup: () => Promise<void> | void;
  export default setup;
}

declare module '#app/components/injections' {
  export const PageRouteSymbol: symbol;
}

declare module '#build/root-component.mjs' {
  const Root: import('vue').Component;
  export default Root;
}

declare module 'h3-next/generic' {
  type EventHandler = (event: { url: URL; method?: string; path?: string }) => unknown;
  export class H3 {
    fetch(request: Request): Promise<Response>;
    use(path: string, handler: EventHandler): void;
  }
}
