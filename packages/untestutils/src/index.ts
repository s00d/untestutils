/**
 * untestutils — thin public facade. Re-exports @untestutils/* packages (no bundling).
 */
export {
  defineRecipe,
  defineRecipes,
  useHarness,
  getCurrentHarness,
  getHarness,
  leaseTarget,
  prepareOnce,
  withHarness,
  ensurePrepared,
  stopAllTargets,
  SCHEMA_VERSION,
  LOOPBACK_HOST,
  loopbackUrl,
  normalizeBaseUrl,
  resolveArtifactsRoot,
  resolveSessionArtifactsRoot,
  sanitizeSession,
  resolveBindHost,
  resolveProbeHost,
  getFreePort,
  waitForHttpReady,
  contentHash,
  FileLock,
  TargetRegistry,
  ArtifactStore,
  envFlag,
  debug,
  scrubTestEnv,
  spawnManaged,
  runCommand,
} from '@untestutils/core';

export type {
  Recipe,
  RecipeFactory,
  RecipeRegistry,
  Running,
  HarnessHandle,
  LeasedTarget,
  SharePolicy,
  PrepareCtx,
  StartCtx,
  HashCtx,
  UseHarnessOptions,
  ManagedProcess,
  StopOpts,
  SpawnOpts,
} from '@untestutils/core';

export { command, staticDir, nodeEntry, host, defineDriver, matrixRecipe } from '@untestutils/core';

export type {
  CommandOptions,
  StaticDirOptions,
  NodeEntryOptions,
  HostOptions,
  Driver,
  MatrixCapableOptions,
  MatrixRecipeOptions,
  FrameworkBaseOptions,
} from '@untestutils/core';
