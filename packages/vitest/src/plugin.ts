import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import {
  ensureRecipes,
  debug,
  getRecipesModulePath,
  resolveSessionArtifactsRoot,
  sanitizeSession,
  type RecipeRegistry,
} from '@untestutils/core';
import {
  createCoverageConfig,
  type CreateCoverageConfigOptions,
  type UntestutilsCoverageConfig,
} from './coverage';
import { type HarnessBrowserName, normalizeHarnessBrowsers } from './browsers';
import { providedContextAugmentation, type UntestutilsProvidedSession } from './provided-context';

void providedContextAugmentation;

export type {
  CreateCoverageConfigOptions,
  CoverageThresholds,
  UntestutilsCoverageConfig,
} from './coverage';
export {
  createCoverageConfig,
  DEFAULT_COVERAGE_THRESHOLDS,
  UNTESTUTILS_WORKSPACE_PACKAGES,
} from './coverage';
export type { HarnessBrowserName } from './browsers';
export {
  HARNESS_BROWSER_NAMES,
  normalizeHarnessBrowsers,
  resolveHarnessBrowserName,
} from './browsers';
export type { UntestutilsProvidedSession } from './provided-context';
export { RetryReporter } from './retry-reporter';

export interface UntestutilsPluginOptions {
  /**
   * Recipe map from `defineRecipes(...)` — import and pass it.
   * Workers re-load via the module path recorded by `defineRecipes` (pass `import.meta.url`
   * as the second arg for reliability).
   */
  recipes?: RecipeRegistry;
  /**
   * Absolute path override for the recipes module. Usually unnecessary when
   * `defineRecipes` ran in that file (or you passed `import.meta.url`).
   */
  recipesModule?: string;
  prewarm?: string[];
  /** Artifacts directory (sets `UNTESTUTILS_ARTIFACTS_DIR`). */
  artifactsRoot?: string;
  /**
   * Isolate TargetRegistry / locks under `.untestutils/sessions/<session>/`
   * so parallel Vitest + Playwright runs do not tear down each other's servers.
   */
  session?: string;
  /**
   * Playwright engines for the `page` / `goto` fixtures.
   * Default `['chromium']`. Multiple engines inject one Vitest project per browser
   * via `injectTestProjects` (each provides `untestutilsBrowser`).
   */
  browsers?: HarnessBrowserName[];
  /**
   * Merge Vitest coverage config (thresholds + include globs).
   * `true` applies app defaults for the src tree; object passes through createCoverageConfig.
   */
  coverage?: boolean | CreateCoverageConfigOptions;
  /**
   * Max recipes prewarmed at once in globalSetup. Default: half the CPU cores (min 1).
   * Env: `UNTESTUTILS_PREWARM_CONCURRENCY`.
   */
  prewarmConcurrency?: number;
  /**
   * Build cache GC at global teardown: per recipe id keep the `keep` most recently used
   * builds plus everything this run used. Default `{ keep: 2 }`; `false` disables.
   * Env: `UNTESTUTILS_GC` (`0` off, or a keep count).
   */
  gc?: boolean | { keep?: number };
  /**
   * Timeout (ms) for building/starting a `test.override({ harness })` target. The build runs
   * in a `beforeAll` of that suite, so it is charged to this budget instead of the first
   * test's `testTimeout`. Default: Vitest `hookTimeout`. `false` = old lazy build inside the
   * first test. Env: `UNTESTUTILS_BUILD_TIMEOUT` (`0` = false).
   */
  buildTimeout?: number | false;
  /**
   * `goto()` waits for Nuxt hydration after `load`/`networkidle`. `'strict'` (default) fails
   * with a clear error when a Nuxt page does not hydrate in time; `'lenient'` keeps the
   * pre-0.8 behaviour (ignore the timeout). Env: `UNTESTUTILS_GOTO_HYDRATION`.
   */
  hydration?: 'strict' | 'lenient';
  /**
   * Retry a failed test up to N times **only** for infrastructure errors
   * ({@link INFRA_ERROR_PATTERN}: connection resets, closed browser/page, …), never for
   * assertion failures. Sets Vitest `retry: { count, condition }` unless `retry` is set.
   * Pair with {@link RetryReporter} to list what was retried.
   */
  retryInfra?: number;
}

/**
 * Errors worth a retry: the harness/browser broke, not the code under test.
 * Use as Vitest `retry.condition` (see {@link infraRetry}).
 */
export const INFRA_ERROR_PATTERN: RegExp =
  /ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|socket hang up|Target page, context or browser has been closed|Browser has been closed|browser has disconnected|Navigation failed because page crashed|net::ERR_CONNECTION_(?:REFUSED|RESET|CLOSED)|net::ERR_EMPTY_RESPONSE/;

/** Vitest `retry` value that retries only {@link INFRA_ERROR_PATTERN} failures. */
export function infraRetry(count = 1): { count: number; condition: RegExp } {
  return { count, condition: INFRA_ERROR_PATTERN };
}

type VitestConfigBag = Record<string, unknown> & {
  sequence?: { setupFiles?: string };
  globalSetup?: string | string[];
  setupFiles?: string | string[];
  coverage?: UntestutilsCoverageConfig | Record<string, unknown>;
  environment?: string;
  provide?: Record<string, unknown>;
  name?: string;
  retry?: unknown;
};

interface VitestPluginContextLike {
  vitest: {
    config: { project?: string | string[] };
    projects: Array<{ name: string }>;
  };
  project: {
    name: string;
    config: VitestConfigBag;
    provide: (key: string, value: unknown) => void;
  };
  injectTestProjects: (config: unknown | unknown[]) => Promise<Array<{ name: string }>>;
}

interface VitestPlugin {
  name: string;
  configureVitest?: (ctx: VitestPluginContextLike) => void | Promise<void>;
}

/**
 * Resolve companion setup files via the installed package root.
 * Prefer createRequire(cwd) so Vite-bundled vitest.config does not rely on
 * rewritten import.meta.url; fall back to siblings of this module for src/tests.
 */
function companion(name: 'global-setup' | 'setup-file'): string {
  return resolveCompanion(name);
}

/** @internal injectable fs/require for companion resolution tests */
export const companionIo: {
  createRequire: typeof createRequire;
  existsSync: typeof existsSync;
  fileURLToPath: typeof fileURLToPath;
} = {
  createRequire,
  existsSync,
  fileURLToPath,
};

/** @internal */
export function resolveCompanion(name: 'global-setup' | 'setup-file'): string {
  const req = companionIo.createRequire(join(process.cwd(), 'package.json'));
  for (const id of [`untestutils/vitest/${name}`, `@untestutils/vitest/${name}`]) {
    try {
      return req.resolve(id);
    } catch {
      /* try next */
    }
  }
  try {
    const pkgRoot = dirname(req.resolve('@untestutils/vitest/package.json'));
    const mjs = join(pkgRoot, 'dist', `${name}.mjs`);
    if (companionIo.existsSync(mjs)) return mjs;
    const ts = join(pkgRoot, 'src', `${name}.ts`);
    if (companionIo.existsSync(ts)) return ts;
  } catch {
    /* */
  }
  const here = dirname(companionIo.fileURLToPath(import.meta.url));
  const localTs = join(here, `${name}.ts`);
  if (companionIo.existsSync(localTs)) return localTs;
  throw new Error(`[untestutils] missing companion ${name}`);
}

function wireProjectConfig(
  config: VitestConfigBag,
  options: UntestutilsPluginOptions,
  browsers: HarnessBrowserName[],
  resolvedRoot: string,
  recipesModule: string | undefined,
): void {
  const env = config.environment;
  if (env === 'untestutils' || env === 'nuxt') {
    throw new Error(
      "[untestutils] Do not mix `untestutils/vitest/plugin` (e2e) with `environment: 'untestutils'` (unit). Use separate Vitest projects.",
    );
  }

  config.sequence ??= {};
  config.sequence.setupFiles = 'list';
  config.globalSetup = [...asArray(config.globalSetup), companion('global-setup')];
  config.setupFiles = [...asArray(config.setupFiles), companion('setup-file')];

  if (options.coverage) {
    const next =
      options.coverage === true ? createCoverageConfig() : createCoverageConfig(options.coverage);
    config.coverage = {
      ...(typeof config.coverage === 'object' && config.coverage ? config.coverage : {}),
      ...next,
      exclude: [
        ...((config.coverage as UntestutilsCoverageConfig | undefined)?.exclude ?? []),
        ...next.exclude,
      ],
      include: next.include,
      thresholds: {
        ...((config.coverage as UntestutilsCoverageConfig | undefined)?.thresholds ?? {}),
        ...next.thresholds,
      },
    };
  }

  if (options.retryInfra && config.retry === undefined) {
    config.retry = infraRetry(options.retryInfra);
  }

  process.env.UNTESTUTILS_PREWARM = JSON.stringify(options.prewarm ?? []);
  if (options.prewarmConcurrency !== undefined) {
    process.env.UNTESTUTILS_PREWARM_CONCURRENCY = String(options.prewarmConcurrency);
  }
  if (options.gc !== undefined) {
    process.env.UNTESTUTILS_GC =
      options.gc === false ? '0' : String((options.gc === true ? undefined : options.gc.keep) ?? 2);
  }
  if (options.buildTimeout !== undefined) {
    process.env.UNTESTUTILS_BUILD_TIMEOUT = String(options.buildTimeout || 0);
  }
  if (options.hydration) process.env.UNTESTUTILS_GOTO_HYDRATION = options.hydration;
  process.env.UNTESTUTILS_BROWSERS = JSON.stringify(browsers);
  if (!process.env.UNTESTUTILS_BROWSER) {
    process.env.UNTESTUTILS_BROWSER = browsers[0];
  }
  process.env.UNTESTUTILS_ARTIFACTS_DIR = resolvedRoot;
  if (options.session) process.env.UNTESTUTILS_SESSION = sanitizeSession(options.session);
  if (recipesModule) {
    process.env.UNTESTUTILS_RECIPES_MODULE = recipesModule;
  } else if ((options.prewarm ?? []).length) {
    debug(
      'vitest',
      'prewarm set but recipes module path unknown — pass recipes from defineRecipes(..., import.meta.url)',
    );
  }
}

function sessionPayload(
  browsers: HarnessBrowserName[],
  resolvedRoot: string,
  recipesModule: string | undefined,
  session: string | undefined,
): UntestutilsProvidedSession {
  return {
    recipesModule,
    artifactsRoot: resolvedRoot,
    session: session ? sanitizeSession(session) : undefined,
    browsers,
    urls: {},
  };
}

/**
 * Vitest/Vite plugin — import from `untestutils/vitest/plugin` in vitest.config.
 */
export function untestutils(options: UntestutilsPluginOptions = {}): VitestPlugin {
  if (options.recipes) {
    ensureRecipes(options.recipes);
  }

  const browsers = normalizeHarnessBrowsers(options.browsers);
  const recipesModule = options.recipesModule ?? getRecipesModulePath();
  const resolvedRoot = resolveSessionArtifactsRoot({
    artifactsRoot: options.artifactsRoot,
    session: options.session,
  });

  return {
    name: 'untestutils',
    async configureVitest(ctx) {
      const { project, vitest, injectTestProjects } = ctx;
      const config = project.config;
      wireProjectConfig(config, options, browsers, resolvedRoot, recipesModule);

      const payload = sessionPayload(browsers, resolvedRoot, recipesModule, options.session);
      project.provide('untestutils', payload);
      project.provide('untestutilsBrowser', browsers[0]);

      if (browsers.length > 1 && typeof injectTestProjects === 'function') {
        const extras = browsers.slice(1);
        for (const browser of extras) {
          const name = `untestutils-${browser}`;
          const filter = vitest.config.project;
          if (Array.isArray(filter) && !filter.includes(name)) {
            filter.push(name);
          }
        }
        await injectTestProjects(
          extras.map((browser) => ({
            test: {
              name: `untestutils-${browser}`,
              provide: {
                untestutils: payload,
                untestutilsBrowser: browser,
              },
            },
          })),
        );
      }

      debug('vitest', 'configured globalSetup + setupFiles + provide session');
    },
  };
}

/**
 * Build separate Vitest project configs for e2e (recipe plugin) and Nuxt unit.
 * Mixing both in one project throws — use this helper instead.
 */
export function createVitestProjects(opts: {
  e2e?: Record<string, unknown>;
  unit?: Record<string, unknown>;
}): Array<Record<string, unknown>> {
  const projects: Array<Record<string, unknown>> = [];
  if (opts.e2e) {
    const test = (opts.e2e.test as Record<string, unknown> | undefined) ?? {};
    if (test.environment === 'untestutils' || test.environment === 'nuxt') {
      throw new Error(
        "[untestutils] createVitestProjects({ e2e }) must not set environment: 'untestutils'. Put unit under { unit }.",
      );
    }
    projects.push({
      ...opts.e2e,
      test: {
        name: 'e2e',
        ...test,
      },
    });
  }
  if (opts.unit) {
    const test = (opts.unit.test as Record<string, unknown> | undefined) ?? {};
    const plugins = (opts.unit.plugins as unknown[] | undefined) ?? [];
    const hasE2e = plugins.some(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        'name' in p &&
        (p as { name: string }).name === 'untestutils',
    );
    if (hasE2e) {
      throw new Error(
        '[untestutils] createVitestProjects({ unit }) must not include the e2e `untestutils()` plugin.',
      );
    }
    projects.push({
      ...opts.unit,
      test: {
        name: 'unit',
        environment: 'untestutils',
        ...test,
      },
    });
  }
  if (!projects.length) {
    throw new Error('[untestutils] createVitestProjects requires at least one of { e2e, unit }');
  }
  return projects;
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
