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
  reclaimStaleTargets,
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
  killProcessTree,
  killPidTree,
  isPidAlive,
} from './process';
export { createRunHelper } from './run-helper';
export { debug, isDebug, log, envFlag } from './debug';
export {
  progress,
  isQuiet,
  isCi,
  isProgressEnabled,
  progressIo,
  withQuietLogger,
} from './progress';
export { computeIdentity, assertUniqueRecipeBinding, resetRecipeBindings } from './identity';

// Drivers (formerly @untestutils/drivers)
export type { Driver } from './drivers/define-driver';
export { defineDriver } from './drivers/define-driver';
export { command } from './drivers/command';
export type { CommandOptions } from './drivers/command';
export { staticDir } from './drivers/static-dir';
export type { StaticDirOptions } from './drivers/static-dir';
export { nodeEntry } from './drivers/node-entry';
export type { NodeEntryOptions } from './drivers/node-entry';
export { host } from './drivers/host';
export type { HostOptions } from './drivers/host';
export {
  resolveBin,
  assertAppRoot,
  cliFrameworkRecipe,
  frameworkRoots,
  _cliInternals,
} from './drivers/cli-framework';
export type {
  ResolveBinOptions,
  SpawnSpec,
  CliFrameworkRecipeOptions,
  FrameworkBaseOptions,
} from './drivers/cli-framework';
export {
  matrixRecipe,
  findWorkspaceRoot,
  workspacePackageSrcDirs,
  shouldIncludeWorkspaceDeps,
  appendWorkspaceHashInputs,
} from './drivers/matrix';
export type { MatrixCapableOptions, MatrixRecipeOptions } from './drivers/matrix';
export {
  installEphemeralFile,
  withEphemeralFile,
  withMergedConfigOverride,
  installMergedConfigOverride,
  writeEphemeralConfig,
  serializeDefaultExport,
  serializeMergedDefaultExport,
  serializeViteMergeConfigModule,
  serializeAstroMergeConfigModule,
  findFirstExistingConfig,
  readTextIfExists,
  configOverrideHashInput,
  deepMergePlain,
} from './drivers/config-override';
