/**
 * untestutils — public facade. Re-exports private workspace packages.
 */
export {
  defineRecipe,
  defineRecipes,
  useHarness,
  getCurrentHarness,
  getHarness,
  ensurePrepared,
  stopAllTargets,
  SCHEMA_VERSION,
  LOOPBACK_HOST,
  loopbackUrl,
  normalizeBaseUrl,
  resolveArtifactsRoot,
  getFreePort,
  waitForHttpReady,
  contentHash,
  FileLock,
  TargetRegistry,
  ArtifactStore,
  envFlag,
  debug,
} from '@untestutils/core';

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
} from '@untestutils/core';

export { command, staticDir, nodeEntry, host, defineDriver } from '@untestutils/drivers';

export type {
  CommandOptions,
  StaticDirOptions,
  NodeEntryOptions,
  HostOptions,
  Driver,
} from '@untestutils/drivers';
