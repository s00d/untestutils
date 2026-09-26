import { defu } from 'defu';
import { fileURLToPath } from 'node:url';
import { setupUnitDom, type UnitDomGlobal, type UnitDomOptions } from '../unit-dom/index';
import {
  applyHostResetLayers,
  applyWorkerIsolationDefaults,
  bumpUnitBootCounter,
  cleanupAll,
  disposeBestEffort,
  invalidateWorkerSetup,
  registerSetupEntry,
  resolveAppIsolation,
  type AppIsolation,
  type DisposableApp,
  type HostResetOptions,
  type SetupEntryWindow,
} from '../unit-lifecycle/index';
import type { InlineConfig as VitestConfig } from 'vitest/node';

export type MarkerDomMount = (root: HTMLElement, marker: string) => void;

export type CreateMarkerUnitFrameworkOptions = {
  framework: string;
  marker: string;
  rootId?: string;
  /**
   * Custom DOM mount used by setup + reset (Vite counter DOM).
   * Default: `root.textContent = marker`.
   */
  setupDom?: MarkerDomMount;
  /**
   * Absolute URL of the package's `runtime/entry` module (for setupFiles).
   * Typically resolved from `import.meta.url` of `src/marker.ts`.
   */
  runtimeEntryUrl: string | URL;
};

const APP_PROP = '__UNTESTUTILS_UNIT_APP__' as const;
const BASELINE_BODY_PROP = '__UNTESTUTILS_BASELINE_BODY__' as const;

function defaultMount(root: HTMLElement, marker: string): void {
  root.textContent = marker;
}

/** Vite-style counter DOM used by playground soft-reset dogfood. */
export function counterSetupDom(root: HTMLElement, marker: string): void {
  root.innerHTML = '';
  const title = document.createElement('h1');
  title.dataset.mark = '1';
  title.textContent = marker;
  const count = document.createElement('span');
  count.id = 'count';
  count.textContent = '0';
  const btn = document.createElement('button');
  btn.id = 'inc';
  btn.type = 'button';
  btn.textContent = '+';
  btn.addEventListener('click', () => {
    count.textContent = String(Number(count.textContent || '0') + 1);
  });
  root.append(title, btn, count);
}

export type FrameworkUnitEnvOptions = {
  url?: string;
  domEnvironment?: UnitDomOptions['domEnvironment'];
  happyDom?: UnitDomOptions['happyDom'];
  jsdom?: UnitDomOptions['jsdom'];
  appIsolation?: AppIsolation;
  resetBetweenTests?: boolean;
  mock?: UnitDomOptions['mock'];
};

export type FrameworkEnvironmentOptions = {
  untestutils?: FrameworkUnitEnvOptions & {
    framework?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type UnitAppHandle = DisposableApp & { rootId: string };

export type UnitConfigOptions = {
  url?: string;
  domEnvironment?: 'happy-dom' | 'jsdom';
  appIsolation?: AppIsolation;
  resetBetweenTests?: boolean;
  [key: string]: unknown;
};

export type DefineVitestConfigInput = {
  test?: VitestConfig & {
    environment?: string;
    environmentOptions?: {
      untestutils?: UnitConfigOptions & {
        framework?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
};

export type ResolvedUnitVitestConfig = DefineVitestConfigInput & {
  extends: false;
  test: NonNullable<DefineVitestConfigInput['test']>;
};

export type MountMarkerResult = {
  el: HTMLElement;
  text: string;
  click: () => Promise<void>;
};

export type ResetSharedAppOptions = HostResetOptions;

export type MarkerUnitEnvironment = {
  name: string;
  viteEnvironment: 'client';
  setup: (
    global: UnitDomGlobal,
    environmentOptions: FrameworkEnvironmentOptions,
  ) => Promise<{ teardown: () => void }>;
};

export type MarkerEntryHooks = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeAll: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  afterEach: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeEach?: any;
};

export type MarkerUnitFramework = {
  FRAMEWORK: string;
  UNIT_MARKER: string;
  ROOT_ID: string;
  environment: MarkerUnitEnvironment;
  defineVitestProject: (config?: DefineVitestConfigInput) => Promise<ResolvedUnitVitestConfig>;
  setupApp: () => Promise<void>;
  tryUseApp: () => UnitAppHandle | null;
  resetSharedApp: (opts?: ResetSharedAppOptions) => Promise<void>;
  restartSharedApp: (win?: SetupEntryWindow) => Promise<void>;
  mountMarker: () => MountMarkerResult;
  getUnitMarkerText: () => string;
  registerEntry: (hooks: MarkerEntryHooks) => void;
};

export function createMarkerUnitFramework(
  opts: CreateMarkerUnitFrameworkOptions,
): MarkerUnitFramework {
  const FRAMEWORK = opts.framework;
  const UNIT_MARKER = opts.marker;
  const ROOT_ID = opts.rootId ?? 'app';
  const mountDom = opts.setupDom ?? defaultMount;
  const UNIT_ENVIRONMENT = 'untestutils';
  const pkgLabel = `untestutils/${FRAMEWORK}`;

  type FrameworkWindow = SetupEntryWindow & {
    __UNTESTUTILS_FRAMEWORK__?: string;
  };

  type AppWindow = Window & {
    __UNTESTUTILS_UNIT_APP__?: UnitAppHandle;
    __UNTESTUTILS_BASELINE_BODY__?: Set<Element>;
  };

  function resolveOptions(
    environmentOptions: FrameworkEnvironmentOptions = {},
  ): FrameworkUnitEnvOptions {
    const ut = environmentOptions.untestutils ?? {};
    const nested = (ut[FRAMEWORK] ??
      environmentOptions[FRAMEWORK] ??
      {}) as FrameworkUnitEnvOptions;
    return {
      url: nested.url ?? ut.url,
      domEnvironment: nested.domEnvironment ?? ut.domEnvironment,
      happyDom: nested.happyDom ?? ut.happyDom,
      jsdom: nested.jsdom ?? ut.jsdom,
      appIsolation: nested.appIsolation ?? ut.appIsolation,
      resetBetweenTests: nested.resetBetweenTests ?? ut.resetBetweenTests,
      mock: nested.mock ?? ut.mock,
    };
  }

  function applyEnvironmentFlags(
    target: FrameworkWindow | (UnitDomGlobal & FrameworkWindow),
    envOpts: FrameworkUnitEnvOptions,
  ): void {
    target.__UNTESTUTILS_ENVIRONMENT__ = true;
    target.__UNTESTUTILS_FRAMEWORK__ = FRAMEWORK;
    if (envOpts.appIsolation) target.__UNTESTUTILS_APP_ISOLATION__ = envOpts.appIsolation;
    if (envOpts.resetBetweenTests !== undefined) {
      target.__UNTESTUTILS_RESET_BETWEEN_TESTS__ = envOpts.resetBetweenTests;
    }
  }

  const environment: MarkerUnitEnvironment = {
    name: 'untestutils',
    viteEnvironment: 'client',
    async setup(global, environmentOptions) {
      const resolved = resolveOptions(environmentOptions);
      const { window: win, teardown } = await setupUnitDom(global, {
        url: resolved.url,
        domEnvironment: resolved.domEnvironment,
        happyDom: resolved.happyDom,
        jsdom: resolved.jsdom,
        mock: {
          intersectionObserver: resolved.mock?.intersectionObserver !== false,
          indexedDb: resolved.mock?.indexedDb,
        },
      });

      const fwWin = win as FrameworkWindow;
      applyEnvironmentFlags(fwWin, resolved);
      applyEnvironmentFlags(global as UnitDomGlobal & FrameworkWindow, resolved);

      if (!fwWin.document.getElementById(ROOT_ID)) {
        const root = fwWin.document.createElement('div');
        root.id = ROOT_ID;
        fwWin.document.body.appendChild(root);
      }

      return { teardown };
    },
  };

  function runtimeFile(rel: string): string {
    const base =
      typeof opts.runtimeEntryUrl === 'string' ? opts.runtimeEntryUrl : opts.runtimeEntryUrl.href;
    return fileURLToPath(new URL(`${rel}.mjs`, base));
  }

  function normalizeSetupFiles(setupFiles: string | string[] | undefined): string[] {
    return Array.isArray(setupFiles)
      ? setupFiles
      : [setupFiles].filter((file): file is string => Boolean(file));
  }

  async function defineVitestProject(
    config: DefineVitestConfigInput = {},
  ): Promise<ResolvedUnitVitestConfig> {
    const resolved = defu(
      { test: { environment: UNIT_ENVIRONMENT } },
      config,
    ) as ResolvedUnitVitestConfig;

    resolved.extends = false;
    resolved.test ??= {} as NonNullable<DefineVitestConfigInput['test']>;
    resolved.test.environment = UNIT_ENVIRONMENT;
    resolved.test.environmentOptions ??= {};

    const ut = (resolved.test.environmentOptions.untestutils ??= {}) as UnitConfigOptions & {
      framework?: string;
      [key: string]: unknown;
    };
    ut.framework = FRAMEWORK;

    const nested = (ut[FRAMEWORK] ??
      resolved.test.environmentOptions[FRAMEWORK] ??
      {}) as UnitConfigOptions;
    const defaults = applyWorkerIsolationDefaults({
      userIsolate: config.test?.isolate,
      appIsolation: nested.appIsolation ?? ut.appIsolation,
      resetBetweenTests: nested.resetBetweenTests ?? ut.resetBetweenTests,
      label: FRAMEWORK,
    });

    ut.appIsolation = defaults.appIsolation;
    if (defaults.resetBetweenTests !== undefined) {
      ut.resetBetweenTests = defaults.resetBetweenTests;
    }
    if (defaults.isolate !== undefined) {
      resolved.test.isolate = defaults.isolate;
    }

    ut[FRAMEWORK] = {
      ...nested,
      appIsolation: ut.appIsolation,
      resetBetweenTests: ut.resetBetweenTests,
      url: nested.url ?? ut.url,
      domEnvironment: nested.domEnvironment ?? ut.domEnvironment,
    };

    resolved.test.setupFiles = normalizeSetupFiles(resolved.test.setupFiles);
    resolved.test.setupFiles.unshift(runtimeFile('entry'));

    return resolved;
  }

  function tryUseApp(): UnitAppHandle | null {
    if (typeof window === 'undefined') return null;
    return (window as AppWindow)[APP_PROP] ?? null;
  }

  async function setupApp(): Promise<void> {
    bumpUnitBootCounter();
    const root = document.getElementById(ROOT_ID);
    if (!root) {
      throw new Error(
        `[${pkgLabel}] #${ROOT_ID} root missing — is environment: 'untestutils' active?`,
      );
    }
    mountDom(root, UNIT_MARKER);
    const w = window as AppWindow;
    w[APP_PROP] = { rootId: ROOT_ID };
    w[BASELINE_BODY_PROP] ??= new Set([...document.body.children]);
  }

  async function resetSharedApp(resetOpts: ResetSharedAppOptions = {}): Promise<void> {
    if (typeof window === 'undefined') return;
    const w = window as AppWindow;

    cleanupAll(w);
    applyHostResetLayers(resetOpts, w);

    const keep = w[BASELINE_BODY_PROP];
    if (keep) {
      for (const child of [...w.document.body.children]) {
        if (!keep.has(child)) child.remove();
      }
    }

    const root = w.document.getElementById(ROOT_ID);
    if (root) mountDom(root, UNIT_MARKER);
  }

  async function restartSharedApp(
    win: SetupEntryWindow = globalThis.window as SetupEntryWindow,
  ): Promise<void> {
    try {
      cleanupAll(win);
    } catch {
      /* ignore — dispose below still runs */
    }
    await disposeBestEffort(tryUseApp, { rootId: ROOT_ID });
    invalidateWorkerSetup(win);
    delete (win as AppWindow)[APP_PROP];
    delete (win as AppWindow)[BASELINE_BODY_PROP];
    await setupApp();
  }

  function mountMarker(): MountMarkerResult {
    const el = document.getElementById(ROOT_ID);
    if (!el) {
      throw new Error(`[${pkgLabel}] #${ROOT_ID} root missing`);
    }
    return {
      el,
      text: el.textContent ?? '',
      async click(): Promise<void> {
        const target = el.querySelector('button, [role="button"]') ?? el;
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      },
    };
  }

  function getUnitMarkerText(): string {
    return UNIT_MARKER;
  }

  function registerEntry(hooks: MarkerEntryHooks): void {
    type FlagCarrier = SetupEntryWindow & {
      __UNTESTUTILS_ENVIRONMENT__?: boolean;
      __UNTESTUTILS_APP_ISOLATION__?: 'file' | 'worker';
      __UNTESTUTILS_RESET_BETWEEN_TESTS__?: boolean;
    };

    const win = (globalThis.window ?? globalThis) as FlagCarrier;

    if (win.__UNTESTUTILS_ENVIRONMENT__ !== true) return;

    const { mode, resetBetweenTests } = resolveAppIsolation(
      {
        appIsolation: win.__UNTESTUTILS_APP_ISOLATION__,
        resetBetweenTests: win.__UNTESTUTILS_RESET_BETWEEN_TESTS__,
      },
      win,
    );

    registerSetupEntry({
      mode,
      resetBetweenTests,
      window: win,
      setup: setupApp,
      tryUseApp,
      reset: resetSharedApp,
      vi: hooks.vi,
      beforeAll: hooks.beforeAll,
      afterEach: hooks.afterEach,
      beforeEach: hooks.beforeEach,
      resetFailureMessage: `[${pkgLabel}] resetSharedApp failed; disposing shared app`,
    });
  }

  return {
    FRAMEWORK: FRAMEWORK,
    UNIT_MARKER: UNIT_MARKER,
    ROOT_ID: ROOT_ID,
    environment: environment,
    defineVitestProject: defineVitestProject,
    setupApp: setupApp,
    tryUseApp: tryUseApp,
    resetSharedApp: resetSharedApp,
    restartSharedApp: restartSharedApp,
    mountMarker: mountMarker,
    getUnitMarkerText: getUnitMarkerText,
    registerEntry: registerEntry,
  };
}
