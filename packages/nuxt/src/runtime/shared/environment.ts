import { defineEventHandler } from './h3';
import { createFetchForH3V1 } from './h3-v1';
import { createFetchForH3V2 } from './h3-v2';
import { createFetch } from 'ofetch';
import { joinURL } from 'ufo';
import { createRouter, exportMatcher, toRouteMatcher } from 'radix3';

type RuntimeConfig = {
  public?: Record<string, unknown>;
  app?: {
    baseURL?: string;
    buildAssetsDir?: string;
    buildId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
export type NuxtRuntimeWindow = Window &
  typeof globalThis & {
    URLSearchParams: typeof globalThis.URLSearchParams;
    Request: typeof globalThis.Request;
    Headers: typeof globalThis.Headers;
    IntersectionObserver?: typeof IntersectionObserver;
    indexedDB?: IDBFactory;
    __NUXT_VITEST_ENVIRONMENT__?: boolean;
    __NUXT__?: {
      serverRendered: boolean;
      config: RuntimeConfig;
      data: Record<string, unknown>;
      state: Record<string, unknown>;
    };
    __registry?: Set<string>;
    __app?:
      | Awaited<ReturnType<typeof createFetchForH3V1>>['h3App']
      | Awaited<ReturnType<typeof createFetchForH3V2>>['h3App'];
  };
export type EnvironmentOptions = {
  nuxtRuntimeConfig?: RuntimeConfig;
  nuxtAppConfig?: {
    rootTag?: string;
    rootAttrs?: Record<string, string | number | boolean | null | undefined>;
    teleportTag?: string;
    teleportAttrs?: Record<string, string | number | boolean | null | undefined>;
  };
  nuxt: {
    rootId?: string;
    h3Version?: 1 | 2;
    url?: string;
    domEnvironment?: 'happy-dom' | 'jsdom';
    mock?: {
      intersectionObserver?: boolean;
      indexedDb?: boolean;
    };
  };
  nuxtRouteRules?: Record<string, unknown>;
};
type SetupWindowCleanup = () => void;

//#region src/runtime/shared/environment.ts
async function setupWindow(
  win: NuxtRuntimeWindow,
  environmentOptions: EnvironmentOptions,
): Promise<SetupWindowCleanup> {
  win.__NUXT_VITEST_ENVIRONMENT__ = true;
  win.__NUXT__ = {
    serverRendered: false,
    config: {
      public: {},
      app: { baseURL: '/' },
      ...environmentOptions?.nuxtRuntimeConfig,
    },
    data: {},
    state: {},
  };
  const consoleInfo = console.info;
  console.info = (...args) => {
    if (args[0] === '<Suspense> is an experimental feature and its API will likely change.') return;
    return consoleInfo(...args);
  };
  const appConfig = environmentOptions.nuxtAppConfig;
  createElementAndAppend(win, appConfig?.rootTag || 'div', {
    ...appConfig?.rootAttrs,
    id: environmentOptions.nuxt.rootId || appConfig?.rootAttrs?.id || 'nuxt-test',
  });
  createElementAndAppend(
    win,
    appConfig?.teleportTag || 'div',
    appConfig?.teleportAttrs || { id: 'teleports' },
  );
  if (!win.fetch || !('Request' in win)) {
    await import('node-fetch-native/polyfill');
    win.URLSearchParams = globalThis.URLSearchParams;
    win.Request ??= class Request extends globalThis.Request {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        if (typeof input === 'string') super(new URL(input, win.location.origin), init);
        else super(input, init);
      }
    };
  }
  const res =
    environmentOptions.nuxt.h3Version === 2
      ? await createFetchForH3V2()
      : await createFetchForH3V1();
  win.fetch = res.fetch;
  // Window may already carry Nitro's `$fetch` augmentation; install ofetch for the unit env.
  Reflect.set(
    win,
    '$fetch',
    createFetch({
      fetch: win.fetch,
      Headers: win.Headers,
    }),
  );
  win.__registry = res.registry;
  win.__app = res.h3App;
  const timestamp = Date.now();
  const routeRulesMatcher = toRouteMatcher(
    createRouter({ routes: environmentOptions.nuxtRouteRules || {} }),
  );
  const matcher = exportMatcher(routeRulesMatcher);
  const manifestOutputPath = joinURL(
    environmentOptions.nuxtRuntimeConfig?.app?.baseURL || '/',
    environmentOptions.nuxtRuntimeConfig?.app?.buildAssetsDir || '_nuxt',
    'builds',
  );
  const manifestBaseRoutePath = joinURL('/_', manifestOutputPath);
  const buildId = win.__NUXT__?.config.app?.buildId || 'test';
  res.h3App.use(
    `${manifestBaseRoutePath}/latest.json`,
    defineEventHandler(() => ({
      id: buildId,
      timestamp,
    })),
  );
  res.h3App.use(
    `${manifestBaseRoutePath}/meta/${buildId}.json`,
    defineEventHandler(() => ({
      id: buildId,
      timestamp,
      matcher,
      prerendered: [],
    })),
  );
  res.registry.add(`${manifestOutputPath}/latest.json`);
  res.registry.add(`${manifestOutputPath}/meta/${buildId}.json`);
  return () => {
    console.info = consoleInfo;
  };
}
function createElementAndAppend(
  win: Window,
  tag: string,
  attrs?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (attrs?.id && win.document.getElementById(String(attrs.id))) return;
  const element = win.document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {}))
    if (value !== false && value !== null && value !== undefined)
      element.setAttribute(key, value === true ? '' : String(value));
  win.document.body.appendChild(element);
}
//#endregion
export { setupWindow };
export type { RuntimeConfig };
