import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import type { Recipe } from '../types';

/** Minimal options every framework matrix can merge. */
export type MatrixCapableOptions = {
  id?: string;
  root: string;
  env?: Record<string, string>;
  hashInputs?: string[];
};

export type MatrixRecipeOptions<Opts extends MatrixCapableOptions> = {
  label: string;
  /**
   * Custom merge of base + variant patch. Default: shallow spread, deep `env`,
   * concat `hashInputs` + `variant:${name}`.
   */
  merge?: (base: Opts, patch: Partial<Opts>, id: string, variantName: string) => Opts;
};

/**
 * Expand one recipe base into many recipes with distinct ids / identity.
 * Variant key `default` keeps `base.id`; other keys become `${baseId}__${key}`.
 */
export function matrixRecipe<Opts extends MatrixCapableOptions>(
  factory: (opts: Opts) => Recipe,
  base: Opts,
  variants: Record<string, Partial<Opts>>,
  options: MatrixRecipeOptions<Opts>,
): Record<string, Recipe> {
  if (!base.root) {
    throw new Error(`[untestutils/${options.label}] matrix() requires base.root`);
  }
  const baseId = base.id ?? `${options.label}-default`;
  const out: Record<string, Recipe> = {};
  const merge =
    options.merge ??
    ((b: Opts, patch: Partial<Opts>, id: string, variantName: string): Opts =>
      ({
        ...b,
        ...patch,
        id,
        env: { ...(b.env ?? {}), ...(patch.env ?? {}) },
        hashInputs: [
          ...(b.hashInputs ?? [b.root]),
          ...(patch.hashInputs ?? []),
          `variant:${variantName}`,
        ],
      }) as Opts);

  for (const [name, patch] of Object.entries(variants)) {
    const id = name === 'default' ? baseId : `${baseId}__${name}`;
    if (out[id]) {
      throw new Error(`[untestutils/${options.label}] matrix() duplicate id "${id}"`);
    }
    const recipe = factory(merge(base, patch, id, name));
    if (Object.values(out).some((r) => r.id === recipe.id)) {
      throw new Error(`[untestutils/${options.label}] matrix() duplicate id "${recipe.id}"`);
    }
    out[id] = recipe;
  }
  return out;
}

/** Walk up from `from` looking for `pnpm-workspace.yaml` / `.yml`. */
export function findWorkspaceRoot(from: string): string | undefined {
  let dir = resolve(from);
  for (let i = 0; i < 12; i++) {
    if (
      existsSync(join(dir, 'pnpm-workspace.yaml')) ||
      existsSync(join(dir, 'pnpm-workspace.yml'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Collect source dirs under the workspace root (for prepare hash).
 * Includes `packages/<name>/src` and, when present, the workspace-root `src/`
 * (module monorepos that ship the Nuxt module outside `packages/`).
 */
export async function workspacePackageSrcDirs(from: string): Promise<string[]> {
  const ws = findWorkspaceRoot(from);
  if (!ws) return [];
  const out: string[] = [];
  const rootSrc = join(ws, 'src');
  if (existsSync(rootSrc)) out.push(rootSrc);
  const packagesDir = join(ws, 'packages');
  if (!existsSync(packagesDir)) return out;
  const names = await readdir(packagesDir, { withFileTypes: true }).catch(() => []);
  for (const e of names) {
    if (!e.isDirectory()) continue;
    const src = join(packagesDir, e.name, 'src');
    if (existsSync(src)) out.push(src);
  }
  return out;
}

/**
 * Whether to include workspace package src dirs in hash inputs.
 * - true: always
 * - auto: when a pnpm workspace root is found
 * - false / undefined: never (CLI adapters default off; Nuxt keeps its own default)
 */
export function shouldIncludeWorkspaceDeps(
  workspaceDeps: boolean | 'auto' | undefined,
  root: string,
): boolean {
  if (workspaceDeps === true) return true;
  if (workspaceDeps === 'auto') return Boolean(findWorkspaceRoot(root));
  return false;
}

/** Append workspace src dirs to hash inputs when enabled. */
export async function appendWorkspaceHashInputs(
  inputs: string[],
  root: string,
  workspaceDeps: boolean | 'auto' | undefined,
): Promise<string[]> {
  if (!shouldIncludeWorkspaceDeps(workspaceDeps, root)) return inputs;
  return [...inputs, ...(await workspacePackageSrcDirs(root))];
}
