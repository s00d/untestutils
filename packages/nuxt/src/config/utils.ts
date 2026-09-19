import { destr } from 'destr';
import { snakeCase } from 'scule';
import { pathToFileURL } from 'node:url';
import { resolveModulePath } from 'exsolve';

export interface ApplyEnvOptions {
  prefix: string;
  altPrefix?: string;
  env?: NodeJS.ProcessEnv;
}

function getEnv(key: string, opts: ApplyEnvOptions): unknown {
  const env = opts.env ?? process.env;
  const envKey = snakeCase(key).toUpperCase();
  return destr(
    env[opts.prefix + envKey] ?? (opts.altPrefix ? env[opts.altPrefix + envKey] : undefined),
  );
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

export function applyEnv(
  obj: Record<string, unknown>,
  opts: ApplyEnvOptions,
  parentKey = '',
): Record<string, unknown> {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (isPlainObject(obj[key])) {
      const child = obj[key];
      if (isPlainObject(envValue)) {
        obj[key] = { ...child, ...envValue };
        applyEnv(obj[key] as Record<string, unknown>, opts, subKey);
      } else if (envValue === undefined) applyEnv(child, opts, subKey);
      else obj[key] = envValue ?? obj[key];
    } else obj[key] = envValue ?? obj[key];
  }
  return obj;
}

/**
 * Deep-copy plain objects and arrays, passing anything else through by reference.
 * `structuredClone` throws on proxies/functions common in `nuxt.options`.
 */
export function deepCopy<T>(
  input: T,
  seen: WeakMap<object, unknown> = new WeakMap<object, unknown>(),
): T {
  if (typeof input !== 'object' || input === null) return input;
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return input;
  const existing = seen.get(input as object);
  if (existing) return existing as T;
  if (Array.isArray(input)) {
    const copy: unknown[] = [];
    seen.set(input, copy);
    for (const item of input) copy.push(deepCopy(item, seen));
    return copy as T;
  }
  const copy: Record<string, unknown> = {};
  seen.set(input as object, copy);
  for (const key in input as Record<string, unknown>)
    copy[key] = deepCopy((input as Record<string, unknown>)[key], seen);
  return copy as T;
}

export async function loadKit(rootDir: string): Promise<typeof import('@nuxt/kit')> {
  try {
    const kitPath = resolveModulePath('@nuxt/kit', { from: tryResolveNuxt(rootDir) || rootDir });
    let kit = (await import(pathToFileURL(kitPath).href)) as typeof import('@nuxt/kit');
    if (!kit.writeTypes)
      kit = {
        ...kit,
        writeTypes: () => {
          throw new Error(
            '`writeTypes` is not available in this version of `@nuxt/kit`. Please upgrade to v3.7 or newer.',
          );
        },
      };
    return kit;
  } catch (e: unknown) {
    if (String(e).includes("Cannot find module '@nuxt/kit'"))
      throw new Error(
        '`@untestutils/nuxt/config` requires `@nuxt/kit`. Install `nuxt` v3+ first.',
        { cause: e },
      );
    throw e;
  }
}

function tryResolveNuxt(rootDir: string): string | null {
  for (const pkg of ['nuxt-nightly', 'nuxt', 'nuxt3', 'nuxt-edge']) {
    const path = resolveModulePath(pkg, { from: rootDir, try: true });
    if (path) return path;
  }
  return null;
}
