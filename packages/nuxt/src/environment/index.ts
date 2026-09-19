import { defu } from 'defu';
import { joinURL } from 'ufo';
import { getPackageInfoSync } from 'local-pkg';
import { indexedDB } from 'fake-indexeddb';
import {
  setupWindow,
  type EnvironmentOptions,
  type NuxtRuntimeWindow,
} from '../runtime/shared/environment';

type VitestGlobal = typeof globalThis & {
  console: Console;
  IntersectionObserver?: typeof IntersectionObserver;
};
type DomEnvironmentOptions = EnvironmentOptions & {
  happyDom?: ConstructorParameters<typeof import('happy-dom').Window>[0];
  jsdom?: ConstructorParameters<typeof import('jsdom').JSDOM>[1] & {
    html?: string;
    userAgent?: string;
    console?: boolean;
    cookieJar?: boolean;
  };
};
type DomEnvironmentResult = {
  window: NuxtRuntimeWindow;
  teardown: () => void;
};
type DomEnvironmentFactory = (
  global: VitestGlobal,
  options: DomEnvironmentOptions,
) => Promise<DomEnvironmentResult>;
type PopulateGlobalResult = {
  keys: Set<string>;
  originals: Map<string, PropertyDescriptor | unknown>;
};
type PopulateGlobal = (
  global: VitestGlobal,
  win: NuxtRuntimeWindow,
  options: { bindFunctions: boolean; additionalKeys: string[] },
) => PopulateGlobalResult;
type VitestEnvironmentsModule = {
  populateGlobal: PopulateGlobal;
};

const happyDomEnvironment: DomEnvironmentFactory = async (_global, { happyDom = {} }) => {
  const { Window, GlobalWindow } = await import('happy-dom');
  const window = new (GlobalWindow || Window)(happyDom) as unknown as NuxtRuntimeWindow;
  return {
    window,
    teardown(): void {
      (window as unknown as { happyDOM: { abort: () => void } }).happyDOM.abort();
    },
  };
};

const jsdomEnvironment: DomEnvironmentFactory = async (global, { jsdom = {} }) => {
  const { CookieJar, JSDOM, ResourceLoader, VirtualConsole } = await import('jsdom');
  const jsdomOptions = defu(jsdom, {
    html: '<!DOCTYPE html>',
    url: 'http://localhost:3000',
    contentType: 'text/html',
    pretendToBeVisual: true,
    includeNodeLocations: false,
    runScripts: 'dangerously' as const,
    console: false,
    cookieJar: false,
  });
  const virtualConsole =
    jsdomOptions.console && global.console ? new VirtualConsole() : undefined;
  const forwardConsole = virtualConsole
    ? forwardVirtualConsole(virtualConsole, global.console)
    : undefined;
  const window = new JSDOM(jsdomOptions.html ?? '<!DOCTYPE html>', {
    ...jsdomOptions,
    resources:
      jsdomOptions.resources ??
      (jsdomOptions.userAgent
        ? new ResourceLoader({ userAgent: jsdomOptions.userAgent })
        : undefined),
    virtualConsole: forwardConsole,
    cookieJar: jsdomOptions.cookieJar ? new CookieJar() : undefined,
  }).window as unknown as NuxtRuntimeWindow;
  window.scrollTo = () => {};
  return {
    window,
    teardown(): void {
      (window as unknown as { close: () => void }).close();
    },
  };
};

const environmentMap: Record<'happy-dom' | 'jsdom', DomEnvironmentFactory> = {
  'happy-dom': happyDomEnvironment,
  jsdom: jsdomEnvironment,
};

const vitestMajor = Number(getPackageInfoSync('vitest')?.version?.split('.')[0]);

class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: readonly number[] = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function forwardVirtualConsole(
  virtualConsole: import('jsdom').VirtualConsole,
  console: Console,
): import('jsdom').VirtualConsole {
  if ('sendTo' in virtualConsole && typeof virtualConsole.sendTo === 'function') {
    return virtualConsole.sendTo(console);
  }
  return virtualConsole.forwardTo(console);
}

async function importVitestEnvironments(): Promise<VitestEnvironmentsModule> {
  const sub = vitestMajor >= 5 ? 'runtime' : 'environments';
  return import(/* @vite-ignore */ `vitest/${sub}`) as Promise<VitestEnvironmentsModule>;
}

function resolveDomFactory(name: string | undefined): DomEnvironmentFactory {
  if (name === 'jsdom') return environmentMap.jsdom;
  return environmentMap['happy-dom'];
}

const environment = {
  name: 'untestutils',
  viteEnvironment: 'client' as const,
  async setup(
    global: VitestGlobal,
    environmentOptions: DomEnvironmentOptions,
  ): Promise<{ teardown: () => void }> {
    const { populateGlobal } = await importVitestEnvironments();
    const url = joinURL(
      environmentOptions.nuxt?.url ?? 'http://localhost:3000',
      environmentOptions.nuxtRuntimeConfig?.app?.baseURL || '/',
    );
    const { window: win, teardown } = await resolveDomFactory(
      environmentOptions.nuxt?.domEnvironment,
    )(
      global,
      defu(environmentOptions, {
        happyDom: { url },
        jsdom: { url },
      }),
    );
    if (environmentOptions.nuxt?.mock?.intersectionObserver) {
      win.IntersectionObserver ||= IntersectionObserverStub;
    }
    if (environmentOptions.nuxt?.mock?.indexedDb) {
      win.indexedDB = indexedDB;
    }
    const teardownWindow = await setupWindow(win, {
      ...environmentOptions,
      nuxt: {
        rootId: environmentOptions.nuxt?.rootId,
        h3Version: environmentOptions.nuxt?.h3Version,
        url: environmentOptions.nuxt?.url,
        domEnvironment: environmentOptions.nuxt?.domEnvironment,
        mock: environmentOptions.nuxt?.mock,
      },
    });
    const { keys, originals } = populateGlobal(global, win, {
      bindFunctions: true,
      additionalKeys: ['fetch', 'Request'],
    });
    return {
      teardown(): void {
        keys.forEach((key: string) => {
          Reflect.deleteProperty(global, key);
        });
        teardownWindow();
        if (vitestMajor >= 5) {
          originals.forEach((descriptor, k: string) => {
            Object.defineProperty(global, k, descriptor as PropertyDescriptor);
          });
        } else {
          originals.forEach((v, k: string) => {
            Reflect.set(global, k, v);
          });
        }
        if (!global.IntersectionObserver) {
          global.IntersectionObserver = IntersectionObserverStub;
        }
        teardown();
      },
    };
  },
};

export default environment;
