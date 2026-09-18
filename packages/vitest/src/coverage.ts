/**
 * Vitest coverage helpers — shared defaults for apps and this monorepo.
 * Import from `untestutils/vitest/plugin` (config-safe; no test.extend).
 */

export interface CoverageThresholds {
  lines: number;
  functions: number;
  statements: number;
  branches: number;
}

export interface CreateCoverageConfigOptions {
  /** Explicit include globs (wins over workspacePackages / default app globs). */
  include?: string[];
  /** Extra exclude globs merged with defaults. */
  exclude?: string[];
  /**
   * Monorepo package folder names under packages/<name>/src.
   * Expands to packages/<name>/src with ts/tsx/mjs/js globs.
   */
  workspacePackages?: string[];
  thresholds?: Partial<CoverageThresholds>;
  reportsDirectory?: string;
  reporter?: string[];
  all?: boolean;
  provider?: 'v8' | 'istanbul';
  /** Also include environment package sources when present. */
  includeEnvironment?: boolean;
}

export interface UntestutilsCoverageConfig {
  provider: 'v8' | 'istanbul';
  reportsDirectory: string;
  reporter: string[];
  all: boolean;
  include: string[];
  exclude: string[];
  thresholds: CoverageThresholds;
}

export const DEFAULT_COVERAGE_THRESHOLDS: CoverageThresholds = {
  lines: 80,
  functions: 80,
  statements: 80,
  branches: 70,
};

const DEFAULT_EXCLUDE = [
  '**/*.d.ts',
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/prompts/**',
  '**/templates/**',
  '**/node_modules/**',
  '**/dist/**',
];

const DEFAULT_APP_INCLUDE = ['src/**/*.{ts,tsx,js,jsx,mjs,vue}'];

/** Default workspace packages covered in the untestutils monorepo. */
export const UNTESTUTILS_WORKSPACE_PACKAGES = [
  'core',
  'drivers',
  'nuxt',
  'vitest',
  'playwright',
  'ai',
  'vite',
  'next',
  'astro',
  'sveltekit',
  'runtime',
  'module',
  'config',
  'untestutils',
] as const;

function workspaceIncludes(names: string[]): string[] {
  return names.map((name) => `packages/${name}/src/**/*.{ts,tsx,mjs,js}`);
}

/**
 * Build a Vitest `test.coverage` object.
 *
 * @example
 * ```ts
 * // consumer app
 * export default defineConfig({
 *   test: { coverage: createCoverageConfig() },
 * })
 *
 * // this monorepo
 * createCoverageConfig({ workspacePackages: [...UNTESTUTILS_WORKSPACE_PACKAGES] })
 * ```
 */
export function createCoverageConfig(
  opts: CreateCoverageConfigOptions = {},
): UntestutilsCoverageConfig {
  const include =
    opts.include ??
    (opts.workspacePackages?.length
      ? [
          ...workspaceIncludes(opts.workspacePackages),
          ...(opts.includeEnvironment
            ? ['packages/vitest-environment-untestutils/**/*.{mjs,js,ts}']
            : []),
        ]
      : [...DEFAULT_APP_INCLUDE]);

  return {
    provider: opts.provider ?? 'v8',
    reportsDirectory: opts.reportsDirectory ?? './coverage',
    reporter: opts.reporter ?? ['text', 'text-summary', 'json', 'json-summary'],
    all: opts.all ?? true,
    include,
    exclude: [...DEFAULT_EXCLUDE, ...(opts.exclude ?? [])],
    thresholds: {
      ...DEFAULT_COVERAGE_THRESHOLDS,
      ...opts.thresholds,
    },
  };
}
