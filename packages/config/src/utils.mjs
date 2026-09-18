import { destr } from 'destr';
import { snakeCase } from 'scule';
import { pathToFileURL } from 'node:url';
import { resolveModulePath } from 'exsolve';
//#region src/utils.ts
function getEnv(key, opts) {
  const env = opts.env ?? process.env;
  const envKey = snakeCase(key).toUpperCase();
  return destr(env[opts.prefix + envKey] ?? env[opts.altPrefix + envKey]);
}
function _isObject(input) {
  return typeof input === 'object' && !Array.isArray(input);
}
function applyEnv(obj, opts, parentKey = '') {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (_isObject(obj[key])) {
      if (_isObject(envValue)) {
        obj[key] = {
          ...obj[key],
          ...envValue,
        };
        applyEnv(obj[key], opts, subKey);
      } else if (envValue === void 0) applyEnv(obj[key], opts, subKey);
      else obj[key] = envValue ?? obj[key];
    } else obj[key] = envValue ?? obj[key];
  }
  return obj;
}
/**
 * Deep-copy plain objects and arrays, passing anything else through by reference.
 *
 * `structuredClone` throws `DataCloneError` on proxies and functions, both of which turn up in
 * `nuxt.options` (module mutation tracking wraps options in proxies) and in user-provided config
 * overrides. Only plain containers need copying here; the clone exists to avoid mutating the
 * caller's objects.
 */
function deepCopy(input, seen = /* @__PURE__ */ new WeakMap()) {
  if (typeof input !== 'object' || input === null) return input;
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return input;
  const existing = seen.get(input);
  if (existing) return existing;
  if (Array.isArray(input)) {
    const copy = [];
    seen.set(input, copy);
    for (const item of input) copy.push(deepCopy(item, seen));
    return copy;
  }
  const copy = {};
  seen.set(input, copy);
  for (const key in input) copy[key] = deepCopy(input[key], seen);
  return copy;
}
async function loadKit(rootDir) {
  try {
    const kitPath = resolveModulePath('@nuxt/kit', { from: tryResolveNuxt(rootDir) || rootDir });
    let kit = await import(pathToFileURL(kitPath).href);
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
  } catch (e) {
    if (e.toString().includes("Cannot find module '@nuxt/kit'"))
      throw new Error(
        '`untestutils/config` requires `@nuxt/kit` to be installed in your project. Try installing `nuxt` v3+ or `@nuxt/bridge` first.',
        { cause: e },
      );
    throw e;
  }
}
function tryResolveNuxt(rootDir) {
  for (const pkg of ['nuxt-nightly', 'nuxt', 'nuxt3', 'nuxt-edge']) {
    const path = resolveModulePath(pkg, {
      from: rootDir,
      try: true,
    });
    if (path) return path;
  }
  return null;
}
//#endregion
export { deepCopy, loadKit, applyEnv };
