import { defu } from 'defu';
import { getPackageInfoSync } from 'local-pkg';
import { indexedDB } from 'fake-indexeddb';

export type UnitDomKind = 'happy-dom' | 'jsdom';

export type UnitDomGlobal = typeof globalThis & {
  console: Console;
  IntersectionObserver?: typeof IntersectionObserver;
};

export type UnitDomOptions = {
  url?: string;
  domEnvironment?: UnitDomKind;
  happyDom?: ConstructorParameters<typeof import('happy-dom').Window>[0];
  jsdom?: ConstructorParameters<typeof import('jsdom').JSDOM>[1] & {
    html?: string;
    userAgent?: string;
    console?: boolean;
    cookieJar?: boolean;
  };
  mock?: {
    intersectionObserver?: boolean;
    indexedDb?: boolean;
  };
};

export type UnitDomWindow = Window &
  typeof globalThis & {
    IntersectionObserver?: typeof IntersectionObserver;
    indexedDB?: IDBFactory;
    scrollTo?: (...args: unknown[]) => void;
  };

export type UnitDomBootstrap = {
  window: UnitDomWindow;
  /** Tear down DOM + restore `populateGlobal` keys (if populated). */
  teardown: () => void;
  /**
   * When `deferPopulate: true`, call after framework window wiring so
   * Vitest globals see the fully initialized window.
   */
  populate: () => void;
};

export type SetupUnitDomOptions = UnitDomOptions & {
  /**
   * When true, skip `populateGlobal` until `bootstrap.populate()` is called.
   * Nuxt needs this so `setupWindow` runs before globals are copied.
   */
  deferPopulate?: boolean;
};

type DomEnvironmentResult = {
  window: UnitDomWindow;
  teardown: () => void;
};

type DomEnvironmentFactory = (
  global: UnitDomGlobal,
  options: UnitDomOptions,
) => Promise<DomEnvironmentResult>;

type PopulateGlobalResult = {
  keys: Set<string>;
  originals: Map<string, PropertyDescriptor | unknown>;
};

type PopulateGlobal = (
  global: UnitDomGlobal,
  win: UnitDomWindow,
  options: { bindFunctions: boolean; additionalKeys: string[] },
) => PopulateGlobalResult;

type VitestEnvironmentsModule = {
  populateGlobal: PopulateGlobal;
};

const vitestMajorRaw = getPackageInfoSync('vitest')?.version?.split('.')[0];
const vitestMajor = Number(vitestMajorRaw ?? 5);

export class IntersectionObserverStub implements IntersectionObserver {
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
  // Prefer Vitest 5 `runtime`; fall back to Vitest 4 `environments`.
  // Dynamic id string (not a static literal) avoids Vite resolving both subpaths at transform time.
  const candidates =
    !Number.isFinite(vitestMajor) || vitestMajor >= 5
      ? (['runtime', 'environments'] as const)
      : (['environments', 'runtime'] as const);
  let last: unknown;
  for (const sub of candidates) {
    const id = ['vitest', sub].join('/');
    try {
      return (await import(/* @vite-ignore */ id)) as VitestEnvironmentsModule;
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

const happyDomEnvironment: DomEnvironmentFactory = async (_global, { happyDom = {} }) => {
  const { Window, GlobalWindow } = await import('happy-dom');
  const window = new (GlobalWindow || Window)(happyDom) as unknown as UnitDomWindow;
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
  const virtualConsole = jsdomOptions.console && global.console ? new VirtualConsole() : undefined;
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
  }).window as unknown as UnitDomWindow;
  window.scrollTo = () => {};
  return {
    window,
    teardown(): void {
      (window as unknown as { close: () => void }).close();
    },
  };
};

const environmentMap: Record<UnitDomKind, DomEnvironmentFactory> = {
  'happy-dom': happyDomEnvironment,
  jsdom: jsdomEnvironment,
};

export function resolveDomFactory(name: string | undefined): DomEnvironmentFactory {
  if (name === 'jsdom') return environmentMap.jsdom;
  return environmentMap['happy-dom'];
}

/**
 * Bootstrap happy-dom/jsdom, apply optional stubs, optionally populate Vitest globals.
 * Callers attach framework-specific window state before returning to Vitest.
 */
export async function setupUnitDom(
  global: UnitDomGlobal,
  options: SetupUnitDomOptions = {},
): Promise<UnitDomBootstrap> {
  const { populateGlobal } = await importVitestEnvironments();
  const url = options.url ?? 'http://localhost:3000';
  const { window: win, teardown: teardownDom } = await resolveDomFactory(options.domEnvironment)(
    global,
    defu(options, {
      happyDom: { url },
      jsdom: { url },
    }),
  );

  if (options.mock?.intersectionObserver !== false) {
    win.IntersectionObserver ||= IntersectionObserverStub;
  }
  if (options.mock?.indexedDb) {
    win.indexedDB = indexedDB;
  }

  let keys: Set<string> | undefined;
  let originals: Map<string, PropertyDescriptor | unknown> | undefined;
  let populated = false;

  const populate = (): void => {
    if (populated) return;
    const result = populateGlobal(global, win, {
      bindFunctions: true,
      additionalKeys: ['fetch', 'Request'],
    });
    keys = result.keys;
    originals = result.originals;
    populated = true;
  };

  if (!options.deferPopulate) populate();

  return {
    window: win,
    populate,
    teardown(): void {
      if (keys && originals) {
        keys.forEach((key: string) => {
          Reflect.deleteProperty(global, key);
        });
        if (vitestMajor >= 5) {
          originals.forEach((descriptor, k: string) => {
            Object.defineProperty(global, k, descriptor as PropertyDescriptor);
          });
        } else {
          originals.forEach((v, k: string) => {
            Reflect.set(global, k, v);
          });
        }
      }
      if (!global.IntersectionObserver) {
        global.IntersectionObserver = IntersectionObserverStub;
      }
      teardownDom();
    },
  };
}

export type {
  UnitFrameworkId,
  ResolveUnitFrameworkOptions,
} from './resolve-framework';
export { UNIT_FRAMEWORK_PACKAGES, UNIT_FRAMEWORK_IDS, resolveUnitFramework } from './resolve-framework';

