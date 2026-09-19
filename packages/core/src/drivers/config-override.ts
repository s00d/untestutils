import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'pathe';

/**
 * Write `contents` to `path` (backing up any existing file). Returns `restore`
 * that puts the previous contents back (or deletes the path if it was new).
 * Use when the file must stay for a long-running process; prefer
 * {@link withEphemeralFile} when the whole critical section is one async fn.
 */
export async function installEphemeralFile(
  path: string,
  contents: string | Buffer,
): Promise<() => Promise<void>> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const backup = `${path}.untestutils-bak`;
  const hadFile = existsSync(path);
  if (hadFile) {
    await copyFile(path, backup);
  }
  await writeFile(path, contents);
  return async () => {
    try {
      await unlink(path);
    } catch {
      /* ignore */
    }
    if (hadFile) {
      try {
        await rename(backup, path);
      } catch {
        try {
          await copyFile(backup, path);
          await unlink(backup);
        } catch {
          /* leave backup for diagnosis */
        }
      }
    } else {
      try {
        await unlink(backup);
      } catch {
        /* no backup */
      }
    }
  };
}

/**
 * Write `contents` to `path`, run `fn`, then restore the previous file (or delete
 * if it did not exist). Safe for tools that only load config from a fixed name
 * (e.g. Next.js `next.config.*`).
 */
export async function withEphemeralFile<T>(
  path: string,
  contents: string | Buffer,
  fn: () => Promise<T>,
): Promise<T> {
  const restore = await installEphemeralFile(path, contents);
  try {
    return await fn();
  } finally {
    await restore();
  }
}

/**
 * Replace `configPath` with an ESM module that merges the previous file + `overrides`,
 * then restore. The previous file is copied to a sibling with a real extension so
 * bundlers (vinxi/esbuild, Next) can import it.
 */
export async function withMergedConfigOverride<T>(
  configPath: string,
  overrides: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const restore = await installMergedConfigOverride(configPath, overrides);
  try {
    return await fn();
  } finally {
    await restore();
  }
}

/** Like {@link withMergedConfigOverride} but restore is deferred (long-running processes). */
export async function installMergedConfigOverride(
  configPath: string,
  overrides: Record<string, unknown>,
): Promise<() => Promise<void>> {
  const dir = dirname(configPath);
  await mkdir(dir, { recursive: true });
  const base = configPath.match(/^(.*?)(\.[cm]?[jt]s)$/);
  const basePath = base
    ? `${base[1]}.untestutils-base${base[2]}`
    : `${configPath}.untestutils-base.mjs`;
  const hadFile = existsSync(configPath);
  if (hadFile) {
    await copyFile(configPath, basePath);
  }
  const contents = hadFile
    ? serializeMergedDefaultExport({
        baseImportSpecifier: pathToFileURL(basePath).href,
        overrides,
      })
    : serializeDefaultExport(overrides);
  const restoreFile = await installEphemeralFile(configPath, contents);
  return async () => {
    await restoreFile();
    try {
      await unlink(basePath);
    } catch {
      /* ignore */
    }
  };
}

/** Write a file (creating parents). Does not restore — for outDir ephemeral configs. */
export async function writeEphemeralConfig(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
}

/**
 * Serialize a JSON-compatible object as `export default <json>`.
 * Suitable for plain config overrides (no functions).
 */
export function serializeDefaultExport(value: unknown): string {
  return `export default ${JSON.stringify(value, null, 2)};\n`;
}

/**
 * Build an ESM module that default-exports merge of `baseImportSpecifier` and overrides.
 * `baseImportSpecifier` must be a valid import path string (absolute file URL or relative).
 */
export function serializeMergedDefaultExport(opts: {
  baseImportSpecifier: string;
  overrides: Record<string, unknown>;
  /** Variable name for the base module default export. */
  baseName?: string;
}): string {
  const baseName = opts.baseName ?? 'base';
  const overridesJson = JSON.stringify(opts.overrides, null, 2);
  return [
    `import ${baseName}Mod from ${JSON.stringify(opts.baseImportSpecifier)};`,
    `const ${baseName} = ${baseName}Mod?.default ?? ${baseName}Mod;`,
    `const overrides = ${overridesJson};`,
    `export default { ...(${baseName} && typeof ${baseName} === 'object' ? ${baseName} : {}), ...overrides };`,
    '',
  ].join('\n');
}

/** Common config filenames to probe under a project root. */
export function findFirstExistingConfig(root: string, basenames: string[]): string | undefined {
  for (const name of basenames) {
    const p = join(root, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

export async function readTextIfExists(path: string): Promise<string | undefined> {
  if (!existsSync(path)) return undefined;
  return readFile(path, 'utf8');
}

/** Append a stable hash fragment for config overrides. */
export function configOverrideHashInput(key: string, value: unknown): string {
  return `${key}:${JSON.stringify(value)}`;
}

/**
 * ESM module for `vite --config`: load the app's vite config from `appRoot`,
 * then mergeConfig with JSON-serializable overrides.
 */
export function serializeViteMergeConfigModule(opts: {
  appRoot: string;
  overrides: Record<string, unknown>;
}): string {
  return [
    `import { mergeConfig, loadConfigFromFile, defineConfig } from "vite";`,
    `const overrides = ${JSON.stringify(opts.overrides)};`,
    `const appRoot = ${JSON.stringify(opts.appRoot)};`,
    `export default defineConfig(async (env) => {`,
    `  const loaded = await loadConfigFromFile(env, undefined, appRoot);`,
    `  return mergeConfig(loaded?.config ?? {}, overrides);`,
    `});`,
    '',
  ].join('\n');
}

/**
 * ESM module for Astro `--config`: merge user config import with overrides.
 * `baseImportSpecifier` should be an absolute file URL to the user's astro config.
 */
export function serializeAstroMergeConfigModule(opts: {
  baseImportSpecifier: string;
  overrides: Record<string, unknown>;
}): string {
  return [
    `import { mergeConfig } from "astro/config";`,
    `import userMod from ${JSON.stringify(opts.baseImportSpecifier)};`,
    `const user = userMod?.default ?? userMod;`,
    `const overrides = ${JSON.stringify(opts.overrides)};`,
    `export default mergeConfig(user && typeof user === "object" ? user : {}, overrides);`,
    '',
  ].join('\n');
}

/** Shallow-aware deep merge for plain JSON-like config objects (no class instances). */
export function deepMergePlain<T extends Record<string, unknown>>(
  base: T,
  patch: Partial<T> | Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const prev = out[k];
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      prev &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      out[k] = deepMergePlain(prev as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
