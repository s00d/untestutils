import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { ensureRecipes, debug, getRecipesModulePath, type RecipeRegistry } from '@untestutils/core';
import {
  createCoverageConfig,
  type CreateCoverageConfigOptions,
  type UntestutilsCoverageConfig,
} from './coverage';

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
   * Merge Vitest coverage config (thresholds + include globs).
   * `true` applies app defaults for the src tree; object passes through createCoverageConfig.
   */
  coverage?: boolean | CreateCoverageConfigOptions;
}

interface VitestPlugin {
  name: string;
  configureVitest?: (ctx: {
    project: {
      config: Record<string, unknown> & {
        sequence?: { setupFiles?: string };
        globalSetup?: string | string[];
        setupFiles?: string | string[];
        coverage?: UntestutilsCoverageConfig | Record<string, unknown>;
      };
    };
  }) => void;
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
export const companionIo = {
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

/**
 * Vitest/Vite plugin — import from `untestutils/vitest/plugin` in vitest.config.
 */
export function untestutils(options: UntestutilsPluginOptions = {}): VitestPlugin {
  if (options.recipes) {
    ensureRecipes(options.recipes);
  }

  const artifactsRoot = options.artifactsRoot;
  const prewarm = options.prewarm ?? [];
  const recipesModule = options.recipesModule ?? getRecipesModulePath();

  return {
    name: 'untestutils',
    configureVitest({ project }) {
      const config = project.config;
      config.sequence ??= {};
      config.sequence.setupFiles = 'list';

      config.globalSetup = [...asArray(config.globalSetup), companion('global-setup')];
      config.setupFiles = [...asArray(config.setupFiles), companion('setup-file')];

      if (options.coverage) {
        const next =
          options.coverage === true
            ? createCoverageConfig()
            : createCoverageConfig(options.coverage);
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

      process.env.UNTESTUTILS_PREWARM = JSON.stringify(prewarm);
      if (artifactsRoot) process.env.UNTESTUTILS_ARTIFACTS_DIR = artifactsRoot;
      if (recipesModule) {
        process.env.UNTESTUTILS_RECIPES_MODULE = recipesModule;
      } else if (prewarm.length) {
        debug(
          'vitest',
          'prewarm set but recipes module path unknown — pass recipes from defineRecipes(..., import.meta.url)',
        );
      }

      debug('vitest', 'configured globalSetup + setupFiles');
    },
  };
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
