/**
 * Vitest environment router: `environment: 'untestutils'`.
 * Dispatches to `@untestutils/<framework>/environment` based on
 * `environmentOptions.untestutils.framework` (legacy: `environmentOptions.nuxt` → nuxt).
 */
export {
  resolveUnitFramework,
  UNIT_FRAMEWORK_PACKAGES,
  UNIT_FRAMEWORK_IDS,
} from '@untestutils/vitest/unit-dom';

import { resolveUnitFramework, UNIT_FRAMEWORK_PACKAGES } from '@untestutils/vitest/unit-dom';

const environment = {
  name: 'untestutils',
  viteEnvironment: 'client',
  /**
   * @param {typeof globalThis} global
   * @param {Record<string, unknown>} environmentOptions
   */
  async setup(global, environmentOptions) {
    const framework = resolveUnitFramework(environmentOptions ?? {});
    const pkg = UNIT_FRAMEWORK_PACKAGES[framework];
    let mod;
    try {
      mod = await import(/* @vite-ignore */ pkg);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[untestutils] failed to load ${pkg} for framework "${framework}". Install @untestutils/${framework}.\n${message}`,
      );
    }
    const env = mod.default ?? mod;
    if (!env || typeof env.setup !== 'function') {
      throw new Error(`[untestutils] ${pkg} does not export a Vitest environment with setup()`);
    }
    return env.setup(global, environmentOptions);
  },
};

export default environment;
