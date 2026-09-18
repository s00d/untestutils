import { defu } from 'defu';
import { joinURL } from 'ufo';
import { createFetch } from 'ofetch';
import { resolveModulePath } from 'exsolve';
import { getPackageInfoSync } from 'local-pkg';
import { indexedDB } from 'fake-indexeddb';
import { createRouter, exportMatcher, toRouteMatcher } from 'radix3';
//#region src/runtime/shared/h3.ts
function defineEventHandler(handler) {
  return Object.assign(handler, { __is_handler__: true });
}
//#endregion
//#region src/runtime/shared/h3-v1.ts
async function createFetchForH3V1() {
  const [{ createApp, toNodeListener }, { fetchNodeRequestHandler }] = await Promise.all([
    import('h3'),
    import('node-mock-http'),
  ]);
  const h3App = createApp();
  const nodeHandler = toNodeListener(h3App);
  const registry = /* @__PURE__ */ new Set();
  const _fetch = fetch;
  const h3Fetch = async (input, _init) => {
    let url;
    let init = _init;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else {
      url = input.url;
      init = {
        method: init?.method ?? input.method,
        body: init?.body ?? input.body,
        headers: init?.headers ?? input.headers,
      };
    }
    const base = url.split('?')[0];
    if (registry.has(base) || registry.has(url)) url = '/_' + url;
    if (url.startsWith('/'))
      return normalizeFetchResponse(await fetchNodeRequestHandler(nodeHandler, url, init));
    return _fetch(input, _init);
  };
  return {
    h3App,
    registry,
    fetch: h3Fetch,
  };
}
/** utils from nitro */
function normalizeFetchResponse(response) {
  if (!response.headers.has('set-cookie')) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeCookieHeaders(response.headers),
  });
}
function normalizeCookieHeader(header = '') {
  return splitCookiesString(joinHeaders(header));
}
function normalizeCookieHeaders(headers) {
  const outgoingHeaders = new Headers();
  for (const [name, header] of headers)
    if (name === 'set-cookie')
      for (const cookie of normalizeCookieHeader(header))
        outgoingHeaders.append('set-cookie', cookie);
    else outgoingHeaders.set(name, joinHeaders(header));
  return outgoingHeaders;
}
function joinHeaders(value) {
  return Array.isArray(value) ? value.join(', ') : String(value);
}
//#endregion
//#region src/runtime/shared/h3-v2.ts
async function createFetchForH3V2() {
  const { H3 } = await import('h3-next/generic');
  const h3App = new H3();
  const registry = /* @__PURE__ */ new Set();
  const _fetch = fetch;
  const h3Fetch = async (input, _init) => {
    let url;
    let init = _init;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else {
      url = input.url;
      init = {
        method: init?.method ?? input.method,
        body: init?.body ?? input.body,
        headers: init?.headers ?? input.headers,
      };
    }
    const base = url.split('?')[0];
    if (registry.has(base) || registry.has(url)) return h3App.fetch(new Request('/_' + url, init));
    if (url.startsWith('/'))
      return new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
      });
    return _fetch(input, _init);
  };
  return {
    h3App,
    registry,
    fetch: h3Fetch,
  };
}
//#endregion
//#region src/runtime/shared/environment.ts
async function setupWindow(win, environmentOptions) {
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
      constructor(input, init) {
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
  win.$fetch = createFetch({
    fetch: win.fetch,
    Headers: win.Headers,
  });
  win.__registry = res.registry;
  win.__app = res.h3App;
  const timestamp = Date.now();
  const routeRulesMatcher = toRouteMatcher(
    createRouter({ routes: environmentOptions.nuxtRouteRules || {} }),
  );
  const matcher = exportMatcher(routeRulesMatcher);
  const manifestOutputPath = joinURL(
    environmentOptions?.nuxtRuntimeConfig?.app?.baseURL || '/',
    environmentOptions?.nuxtRuntimeConfig?.app?.buildAssetsDir || '_nuxt',
    'builds',
  );
  const manifestBaseRoutePath = joinURL('/_', manifestOutputPath);
  const buildId = win.__NUXT__.config?.app.buildId || 'test';
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
function createElementAndAppend(win, tag, attrs) {
  if (attrs?.id && win.document.getElementById(attrs.id)) return;
  const element = win.document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {}))
    if (value !== false && value !== null && value !== undefined)
      element.setAttribute(key, value === true ? '' : String(value));
  win.document.body.appendChild(element);
}
//#endregion
//#region src/environments/vitest/env/happy-dom.ts
const happy_dom_default = async function (_, { happyDom = {} }) {
  const { Window, GlobalWindow } = await import('happy-dom');
  const window = new (GlobalWindow || Window)(happyDom);
  return {
    window,
    teardown() {
      window.happyDOM.abort();
    },
  };
};
//#endregion
//#region src/environments/vitest/env/jsdom.ts
const jsdom_default = async function (global, { jsdom = {} }) {
  const { CookieJar, JSDOM, ResourceLoader, VirtualConsole } = await import('jsdom');
  const jsdomOptions = defu(jsdom, {
    html: '<!DOCTYPE html>',
    url: 'http://localhost:3000',
    contentType: 'text/html',
    pretendToBeVisual: true,
    includeNodeLocations: false,
    runScripts: 'dangerously',
    console: false,
    cookieJar: false,
  });
  const virtualConsole = jsdomOptions.console && global.console ? new VirtualConsole() : void 0;
  const window = new JSDOM(jsdomOptions.html, {
    ...jsdomOptions,
    resources:
      jsdomOptions.resources ??
      (jsdomOptions.userAgent
        ? ResourceLoader
          ? new ResourceLoader({ userAgent: jsdomOptions.userAgent })
          : { userAgent: jsdomOptions.userAgent }
        : void 0),
    virtualConsole: virtualConsole
      ? 'sendTo' in virtualConsole
        ? virtualConsole.sendTo(global.console)
        : virtualConsole.forwardTo(global.console)
      : void 0,
    cookieJar: jsdomOptions.cookieJar ? new CookieJar() : void 0,
  }).window;
  window.scrollTo = () => {};
  return {
    window,
    teardown() {
      window.close();
    },
  };
};
//#endregion
//#region src/environments/vitest/index.ts
const environmentMap = {
  'happy-dom': happy_dom_default,
  jsdom: jsdom_default,
};
const vitestMajor = Number(getPackageInfoSync('vitest')?.version?.split('.')[0]);
const vitest_default = {
  name: 'untestutils',
  viteEnvironment: 'client',
  async setup(global, environmentOptions) {
    const { populateGlobal } = await importVitestEnvironments();
    const url = joinURL(
      environmentOptions.nuxt?.url ?? 'http://localhost:3000',
      environmentOptions.nuxtRuntimeConfig?.app?.baseURL || '/',
    );
    const environmentName = environmentOptions.nuxt?.domEnvironment;
    const { window: win, teardown } = await (
      environmentMap[environmentName] || environmentMap['happy-dom']
    )(
      global,
      defu(environmentOptions, {
        happyDom: { url },
        jsdom: { url },
      }),
    );
    if (environmentOptions.nuxt?.mock?.intersectionObserver)
      win.IntersectionObserver ||= IntersectionObserver;
    if (environmentOptions.nuxt?.mock?.indexedDb) win.indexedDB = indexedDB;
    const teardownWindow = await setupWindow(win, environmentOptions);
    const { keys, originals } = populateGlobal(global, win, {
      bindFunctions: true,
      additionalKeys: ['fetch', 'Request'],
    });
    return {
      teardown() {
        keys.forEach((key) => delete global[key]);
        teardownWindow();
        if (vitestMajor >= 5)
          originals.forEach((descriptor, k) => Object.defineProperty(global, k, descriptor));
        else originals.forEach((v, k) => (global[k] = v));
        if (!global.IntersectionObserver) global.IntersectionObserver = IntersectionObserver;
        teardown();
      },
    };
  },
};
async function importVitestEnvironments() {
  return await import(
    /* @vite-ignore */
    [
      'vitest',
      vitestMajor >= 5 || resolveModulePath('vitest/runtime', { try: true })
        ? 'runtime'
        : 'environments',
    ].join('/')
  );
}
const IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};
//#endregion
export { vitest_default as default };
