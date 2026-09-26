/**
 * Public Vitest barrel for specs.
 * Config files must import the plugin from `untestutils/vitest/plugin`
 * so `test.extend` is not evaluated during config load.
 */
export { untestutils, createVitestProjects } from './plugin';
export type { UntestutilsPluginOptions, UntestutilsProvidedSession } from './plugin';
export {
  useHarness,
  defineRecipes,
  defineRecipe,
  leaseTarget,
  prepareOnce,
  withHarness,
} from '@untestutils/core';
export type { HarnessHandle, Recipe, LeasedTarget } from '@untestutils/core';
export { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from './fixtures';
export type { HarnessFixtures, HarnessBrowserName } from './fixtures';
export {
  HARNESS_BROWSER_NAMES,
  normalizeHarnessBrowsers,
  resolveHarnessBrowserName,
} from './browsers';
export {
  cleanupAll,
  addCleanup,
  removeCleanup,
  bumpUnitBootCounter,
  clearTimersAndStubs,
  applyHostResetLayers,
  disposeBestEffort,
  registerSetupEntry,
  resolveAppIsolation,
  invalidateWorkerSetup,
  applyWorkerIsolationDefaults,
} from './unit-lifecycle/index';
export type {
  AppIsolation,
  SetupEntryWindow,
  DisposableApp,
  RegisterSetupEntryOptions,
  HostResetOptions,
  WorkerIsolationDefaultsInput,
  WorkerIsolationDefaultsResult,
} from './unit-lifecycle/index';
