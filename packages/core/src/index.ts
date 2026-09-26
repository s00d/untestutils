export type {
  Recipe,
  RecipeFactory,
  RecipeRegistry,
  Running,
  HarnessHandle,
  SharePolicy,
  PrepareCtx,
  StartCtx,
  HashCtx,
  UseHarnessOptions,
} from './types';
export { SCHEMA_VERSION } from './types';
export {
  defineRecipe,
  defineRecipes,
  ensureRecipes,
  getRegisteredRecipe,
  getRecipesModulePath,
  listRegisteredRecipes,
  clearRegisteredRecipes,
} from './recipes';
export {
  useHarness,
  getCurrentHarness,
  getHarness,
  leaseTarget,
  prepareOnce,
  withHarness,
} from './harness';
export type { LeaseOptions, LeasedTarget } from './harness';
export { sanitizeSession, resolveSessionArtifactsRoot } from './session';
export {
  ensurePrepared,
  stopAllTargets,
  resolveRecipe,
  detachLiveTargetsForTests,
} from './orchestrator';
export { TargetRegistry, envKey, envDirKey } from './target-registry';
export { ArtifactStore } from './artifact-store';
export { FileLock, atomicWriteJson, atomicWriteText, lockPathFor } from './lock';
export { contentHash, sha1, hashString, collectFileHashes } from './hash';
export { getFreePort, waitForPort } from './ports';
export {
  LOOPBACK_HOST,
  loopbackUrl,
  normalizeBaseUrl,
  resolveArtifactsRoot,
  resolveBindHost,
  resolveProbeHost,
  findRepoRoot,
} from './paths';
export { waitForHttpReady, defaultReady } from './ready';
export {
  scrubTestEnv,
  spawnManaged,
  runCommand,
} from './process';
export type { StopOpts, ManagedProcess, SpawnOpts } from './process';
export { createRunHelper } from './run-helper';
export { debug, isDebug, log, envFlag } from './debug';
export {
  progress,
  isCi,
  isProgressEnabled,
  progressIo,
  withQuietLogger,
} from './progress';
export { computeIdentity, assertUniqueRecipeBinding, resetRecipeBindings } from './identity';

// Drivers (formerly @untestutils/drivers)
export * from './drivers';
export type * from './drivers';
