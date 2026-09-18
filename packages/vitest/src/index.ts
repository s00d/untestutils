/**
 * Public Vitest barrel for specs.
 * Config files must import the plugin from `untestutils/vitest/plugin`
 * so `test.extend` is not evaluated during config load.
 */
export { untestutils } from './plugin';
export type { UntestutilsPluginOptions } from './plugin';
export { useHarness, defineRecipes, defineRecipe } from '@untestutils/core';
export type { HarnessHandle, Recipe } from '@untestutils/core';
export { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from './fixtures';
export type { HarnessFixtures, HarnessBrowserName } from './fixtures';
export {
  HARNESS_BROWSER_NAMES,
  normalizeHarnessBrowsers,
  resolveHarnessBrowserName,
} from './browsers';
