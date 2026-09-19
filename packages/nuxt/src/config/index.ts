/**
 * Vitest config helpers for Nuxt unit tests (`@untestutils/nuxt/config`).
 */
import { deepCopy, loadKit, applyEnv } from './utils';
import { createDefu, defu } from 'defu';
import { resolveModulePath } from 'exsolve';
import process from 'node:process';
import { setupDotenv, type DotenvOptions } from 'c12';
import { getPackageInfoSync } from 'local-pkg';
import { fileURLToPath } from 'node:url';
import type { Nuxt, NuxtConfig, ViteConfig as NuxtViteConfig } from '@nuxt/schema';
import { version, type InlineConfig as VitestConfig } from 'vitest/node';
import type { Plugin, UserConfig as ViteUserConfig, ResolvedConfig } from 'vite';

/** Absolute path to a sibling runtime emit file (`.mjs` after build). */
function runtimeFile(rel: string): string {
  return fileURLToPath(new URL(`../runtime/${rel}.mjs`, import.meta.url));
}

function isUnitEnvironmentName(env: unknown): boolean {
  return env === 'untestutils' || env === 'nuxt';
}

type NitroRef = { current?: { hooks: { callHook: (name: 'close') => Promise<void> } } };
type LoadedNuxtViteConfig = {
  nuxt: Nuxt;
  viteConfig: NuxtViteConfig;
  nitro?: NitroRef;
};
type StartNuxtOptions = {
  dotenv?: Partial<DotenvOptions>;
  nitroEnvironment?: boolean;
  overrides?: Partial<NuxtConfig>;
};
type ResolvedVitestConfig = ViteUserConfig & {
  extends?: false;
  test: VitestConfig;
  plugins: Plugin[];
  optimizeDeps?: { noDiscovery?: boolean; include?: string[] };
  define?: Record<string, unknown>;
  ssr?: { resolve?: { conditions?: string[] } };
  customLogger?: unknown;
};

function isNamedPlugin(plugin: unknown): plugin is Plugin {
  return typeof plugin === 'object' && plugin !== null && 'name' in plugin;
}

/** Reject e2e plugin + unit environment in the same Vitest project. */
export function assertNoE2ePluginMixed(config: {
  plugins?: unknown[];
  test?: { environment?: unknown };
}): void {
  const plugins = config.plugins || [];
  const hasE2e = plugins.some((p) => isNamedPlugin(p) && p.name === 'untestutils');
  const env = config.test?.environment;
  if (hasE2e && isUnitEnvironmentName(env)) {
    throw new Error(
      "[untestutils] Do not mix `untestutils/vitest/plugin` (e2e) with `environment: 'untestutils'` (unit). Use separate Vitest projects.",
    );
  }
}

const PLUGIN_NAME = 'untestutils:vitest:environment-options';
const STUB_ID = 'untestutils-vitest-environment-options';

function NuxtVitestEnvironmentOptionsPlugin(
  environmentOptions: Record<string, unknown> = {},
): Plugin {
  return {
    name: PLUGIN_NAME,
    enforce: 'pre' as const,
    resolveId(id: string): string | undefined {
      if (id.endsWith(STUB_ID)) return STUB_ID;
    },
    load(id: string): string | undefined {
      if (id.endsWith(STUB_ID)) return `export default ${JSON.stringify(environmentOptions || {})}`;
    },
  };
}

const DISABLE_NITRO_ENVIRONMENT = {
  experimental: { nitroViteEnvironment: false },
} as Partial<NuxtConfig>;

async function startNuxtAndGetViteConfig(
  rootDir = process.cwd(),
  options: StartNuxtOptions = {},
): Promise<LoadedNuxtViteConfig> {
  const { buildNuxt, loadNuxt } = await loadKit(rootDir);
  const nuxt = await loadNuxt({
    cwd: rootDir,
    dev: options.nitroEnvironment || (options.overrides?.dev ?? false),
    dotenv: defu(options.dotenv, {
      cwd: rootDir,
      fileName: '.env.test',
    }),
    defaults: { compatibilityDate: '2024-04-03' },
    overrides: defu(
      {
        appId: 'nuxt-app',
        buildId: 'test',
        ssr: false,
        test: true,
        modules: ['@untestutils/nuxt/module'],
        experimental: { appManifest: false },
      },
      options.overrides,
      options.nitroEnvironment ? {} : DISABLE_NITRO_ENVIRONMENT,
    ),
  });
  if (!nuxt.options._installedModules.find((i) => i?.meta?.name === 'untestutils'))
    throw new Error(
      'Failed to load `@untestutils/nuxt/module`. Add it to your nuxt.config modules.',
    );
  const nitro: NitroRef | undefined = options.nitroEnvironment ? {} : undefined;
  if (nitro)
    (nuxt.hook as (name: 'nitro:init', callback: (instance: NitroRef['current']) => void) => void)(
      'nitro:init',
      (instance) => {
        nitro.current = instance;
      },
    );
  return new Promise<LoadedNuxtViteConfig>((resolve, reject) => {
    nuxt.hook('vite:configResolved', (viteConfig, { isClient }) => {
      if (isClient) {
        resolve({ nuxt, viteConfig, nitro });
        throw new Error('_stop_');
      }
    });
    buildNuxt(nuxt).catch((err: unknown) => {
      if (!String(err).includes('_stop_')) reject(err);
    });
  }).finally(() => nuxt.close());
}

function nitroTeardownPlugin(nitro: NitroRef): Plugin {
  let closed: Promise<void> | undefined;
  return {
    name: 'untestutils:nitro-teardown',
    async closeBundle(): Promise<void> {
      closed ||= nitro.current?.hooks.callHook('close') ?? Promise.resolve();
      await closed;
    },
  };
}

const excludedPlugins = [
  'nuxt:import-protection',
  'nuxt:import-conditions',
  'nuxt:devtools:rpc',
  'nuxt:devtools:config-retriever',
  'vite-plugin-checker',
  'vite-plugin-inspect',
  'vite-plugin-vue-tracer',
];

export interface NuxtConfigOptions {
  rootDir?: string;
  domEnvironment?: 'happy-dom' | 'jsdom';
  overrides?: Partial<NuxtConfig>;
  dotenv?: Partial<DotenvOptions>;
  nitroEnvironment?: boolean;
  [key: string]: unknown;
}

export interface DefineVitestConfigInput extends ViteUserConfig {
  test?: VitestConfig & {
    environment?: string;
    environmentOptions?: { nuxt?: NuxtConfigOptions; [key: string]: unknown };
  };
}

export async function getVitestConfigFromNuxt(
  options?: LoadedNuxtViteConfig,
  loadNuxtOptions: StartNuxtOptions = {},
): Promise<ResolvedVitestConfig> {
  const { rootDir: rawRootDir = process.cwd(), ..._overrides } = loadNuxtOptions.overrides || {};
  const rootDir = typeof rawRootDir === 'string' ? rawRootDir : process.cwd();
  if (!options)
    options = await startNuxtAndGetViteConfig(rootDir, {
      dotenv: loadNuxtOptions.dotenv,
      nitroEnvironment: loadNuxtOptions.nitroEnvironment,
      overrides: { test: true, ..._overrides },
    });
  const viteConfig: ViteUserConfig = {
    ...options.viteConfig,
    root: undefined,
    plugins: [...(options.viteConfig.plugins || [])].filter(
      (p) => !isNamedPlugin(p) || !excludedPlugins.includes(p.name),
    ),
  };
  const nuxtServerIntegration = getPackageInfoSync('@nuxt/nitro-server', {
    paths: [options.nuxt.options.appDir],
  });
  let nitroPath: string | undefined;
  for (const nitroCandidate of [
    ...(nuxtServerIntegration?.packageJson.dependencies?.nitro
      ? ['nitro', 'nitro-nightly']
      : ['nitropack', 'nitropack-nightly']),
  ]) {
    nitroPath = resolveModulePath(nitroCandidate, {
      from: nuxtServerIntegration?.rootPath || options.nuxt.options.appDir,
      try: true,
    });
    if (nitroPath) break;
  }
  const projectH3Path = resolveModulePath('h3/package.json', {
    from: rootDir,
    try: true,
  });
  const h3Info =
    (projectH3Path ? getPackageInfoSync('h3', { paths: [projectH3Path] }) : undefined) ||
    getPackageInfoSync('h3', {
      paths: nitroPath ? [nitroPath] : options.nuxt.options.modulesDir,
    });
  const routeRules =
    'routeRules' in options.nuxt.options && isObjectRecord(options.nuxt.options.routeRules)
      ? options.nuxt.options.routeRules
      : undefined;
  const nitroOptions =
    'nitro' in options.nuxt.options && isObjectRecord(options.nuxt.options.nitro)
      ? options.nuxt.options.nitro
      : undefined;
  const resolvedConfig = defu(
    {
      define: {
        'process.env.NODE_ENV': '"test"',
        __NUXT_VITEST_RESOLVED__: 'true',
      },
      resolve: {
        alias: {
          '@vue/devtools-kit': runtimeFile('mocks/vue-devtools'),
          '@vue/devtools-core': runtimeFile('mocks/vue-devtools'),
        },
      },
      optimizeDeps: { noDiscovery: true },
      test: {
        environmentOptions: {
          nuxtRuntimeConfig: applyEnv(deepCopy(options.nuxt.options.runtimeConfig), {
            prefix: 'NUXT_',
            env: await setupDotenv(
              defu(loadNuxtOptions.dotenv, {
                cwd: rootDir,
                fileName: '.env.test',
              }),
            ),
          }),
          nuxtRouteRules: defu(
            {},
            routeRules,
            isObjectRecord(nitroOptions?.routeRules) ? nitroOptions.routeRules : undefined,
          ),
          nuxtAppConfig: {
            rootAttrs: options.nuxt.options.app.rootAttrs,
            rootTag: options.nuxt.options.app.rootTag,
            teleportAttrs: options.nuxt.options.app.teleportAttrs,
            teleportTag: options.nuxt.options.app.teleportTag,
          },
        },
        server: {
          deps: {
            inline: [
              /\/node_modules\/(.*\/)?(nuxt|nuxt3|nuxt-nightly)\//,
              /^#/,
              'untestutils',
              '@untestutils/nuxt',
              'vitest-environment-untestutils',
              ...options.nuxt.options.build.transpile.filter(
                (r: unknown) => typeof r === 'string' || r instanceof RegExp,
              ),
            ],
          },
        },
        deps: { optimizer: { client: { enabled: false } } },
      },
    },
    {
      server: { middlewareMode: false },
      plugins: [
        {
          name: 'disable-auto-execute',
          enforce: 'pre',
          transform(code: string, id: string) {
            if (id.match(/nuxt(3|-nightly)?\/.*\/entry\./))
              return code.replace(/(?<!vueAppPromise = )entry\(\)/, 'Promise.resolve()');
          },
        },
        ...(options.nitro ? [nitroTeardownPlugin(options.nitro)] : []),
        {
          name: 'untestutils:browser-conditions',
          enforce: 'pre',
          config(): ViteUserConfig {
            return { resolve: { conditions: ['web', 'import', 'module', 'default'] } };
          },
          configResolved(config: ResolvedConfig) {
            if (config.ssr.resolve?.conditions)
              config.ssr.resolve.conditions = config.ssr.resolve.conditions.filter(
                (x: string) => x !== 'import',
              );
          },
        },
      ],
    },
    viteConfig,
    {
      test: {
        environmentOptions: {
          nuxt: {
            rootId: options.nuxt.options.app.rootAttrs?.id || undefined,
            h3Version: h3Info?.version?.startsWith('2.') ? 2 : 1,
            mock: {
              intersectionObserver: true,
              indexedDb: false,
            },
          },
        },
      },
    },
  ) as ResolvedVitestConfig;
  resolvedConfig.define ??= {};
  delete resolvedConfig.define['process.browser'];
  delete resolvedConfig.customLogger;
  delete resolvedConfig.ssr;
  resolvedConfig.test.setupFiles = normalizeSetupFiles(resolvedConfig.test.setupFiles);
  resolvedConfig.test.setupFiles.unshift(runtimeFile('entry'));
  return resolvedConfig;
}

const vitestMajor = Number(version.split('.')[0]);
const UNIT_ENVIRONMENT = 'untestutils';

export async function defineVitestProject(
  config?: DefineVitestConfigInput,
): Promise<ResolvedVitestConfig> {
  const resolvedConfig = await resolveConfig(
    defu({ test: { environment: UNIT_ENVIRONMENT } }, config),
  );
  resolvedConfig.extends ??= false;
  assertNoE2ePluginMixed(resolvedConfig);
  return resolvedConfig;
}

export function defineVitestConfig(
  config: DefineVitestConfigInput = {},
): () => Promise<ResolvedVitestConfig> {
  return async () => {
    const resolvedConfig = await resolveConfig(config);
    if (resolvedConfig.test.browser?.enabled) return resolvedConfig;
    if ('workspace' in resolvedConfig.test || 'projects' in resolvedConfig.test)
      throw new Error(
        'The `projects` option is not supported with `defineVitestConfig`. Use `defineVitestProject` per project.',
      );
    const defaultEnvironment = resolvedConfig.test.environment || 'node';
    const isUnitEnv = isUnitEnvironmentName(defaultEnvironment);
    if (!isUnitEnv) {
      const merge = createDefu((obj, key, value): true | undefined => {
        if (Array.isArray(value) && Array.isArray(obj[key as string])) {
          const target = obj as Record<string, unknown[]>;
          const stringKey = String(key);
          target[stringKey] = [...new Set([...value, ...target[stringKey]])];
          return true;
        }
      });
      const nuxtProject = merge(
        {
          ...resolvedConfig,
          extends: false,
          test: {
            ...resolvedConfig.test,
            name: 'untestutils',
            environment: UNIT_ENVIRONMENT,
            include: [],
          },
        },
        resolvedConfig,
      ) as ResolvedVitestConfig;
      nuxtProject.test.include = [
        '**/*.{nuxt,untestutils}.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        '{test,tests}/{nuxt,untestutils}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ];
      const defaultProject = merge(
        {
          ...resolvedConfig,
          extends: false,
          test: {
            ...resolvedConfig.test,
            name: defaultEnvironment,
            environment: defaultEnvironment,
            exclude: [
              '**/node_modules/**',
              '**/dist/**',
              '**/cypress/**',
              '**/.{idea,git,cache,output,temp}/**',
              '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
              ...nuxtProject.test.include,
            ],
          },
        },
        resolvedConfig,
      ) as ResolvedVitestConfig;
      delete resolvedConfig.test.name;
      delete resolvedConfig.test.environment;
      delete resolvedConfig.test.include;
      delete resolvedConfig.test.exclude;
      delete resolvedConfig.test.includeSource;
      delete defaultProject.test.includeSource;
      resolvedConfig.test.projects = [nuxtProject, defaultProject];
    } else {
      resolvedConfig.test.environment = UNIT_ENVIRONMENT;
    }
    assertNoE2ePluginMixed(resolvedConfig);
    return resolvedConfig;
  };
}

function isCoverageEnabled(config: DefineVitestConfigInput): boolean {
  if (config.test && 'coverage' in config.test && config.test.coverage?.enabled) return true;
  return process.argv.some(
    (arg) =>
      arg === '--coverage' ||
      arg === '--coverage.enabled' ||
      arg === '--coverage=true' ||
      arg === '--coverage.enabled=true',
  );
}

async function resolveConfig(config: DefineVitestConfigInput): Promise<ResolvedVitestConfig> {
  const overrides = config.test?.environmentOptions?.nuxt?.overrides || {};
  overrides.rootDir = config.test?.environmentOptions?.nuxt?.rootDir;
  if (isCoverageEnabled(config)) {
    if (overrides.sourcemap === undefined) overrides.sourcemap = { client: true };
    else if (isObjectRecord(overrides.sourcemap) && overrides.sourcemap.client === undefined)
      overrides.sourcemap.client = true;
  }
  if (config.test?.setupFiles && !Array.isArray(config.test.setupFiles))
    config.test.setupFiles = normalizeSetupFiles(config.test.setupFiles);
  const resolvedConfig = defu(
    config,
    await getVitestConfigFromNuxt(undefined, {
      dotenv: config.test?.environmentOptions?.nuxt?.dotenv,
      nitroEnvironment: config.test?.environmentOptions?.nuxt?.nitroEnvironment,
      overrides: deepCopy(overrides),
    }),
  ) as ResolvedVitestConfig;
  resolvedConfig.plugins.push(
    NuxtVitestEnvironmentOptionsPlugin(resolvedConfig.test.environmentOptions),
  );
  if (resolvedConfig.test.browser?.enabled) {
    if (vitestMajor >= 5) {
      delete resolvedConfig.optimizeDeps?.noDiscovery;
      resolvedConfig.optimizeDeps ??= {};
      resolvedConfig.optimizeDeps.include ??= [];
      resolvedConfig.optimizeDeps.include.push('@testing-library/vue', 'h3-next/generic');
    }
    resolvedConfig.plugins.push({
      name: 'untestutils:browser-client-environment',
      configEnvironment(name: string) {
        if (name === 'client') return { dev: { moduleRunnerTransform: false } };
      },
    });
    if (resolvedConfig.test.environment === 'untestutils') {
      resolvedConfig.test.setupFiles = normalizeSetupFiles(resolvedConfig.test.setupFiles);
      resolvedConfig.test.setupFiles.unshift(runtimeFile('browser-entry'));
    }
  }
  return resolvedConfig;
}

function normalizeSetupFiles(setupFiles: string | string[] | undefined): string[] {
  return Array.isArray(setupFiles)
    ? setupFiles
    : [setupFiles].filter((file): file is string => Boolean(file));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
