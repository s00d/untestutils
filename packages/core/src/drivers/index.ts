export type { Driver } from './define-driver';
export { defineDriver } from './define-driver';
export { command } from './command';
export type { CommandOptions } from './command';
export { staticDir } from './static-dir';
export type { StaticDirOptions } from './static-dir';
export { nodeEntry } from './node-entry';
export type { NodeEntryOptions } from './node-entry';
export { host } from './host';
export type { HostOptions } from './host';
export {
  resolveBin,
  assertAppRoot,
  cliFrameworkRecipe,
  frameworkRoots,
  _cliInternals,
} from './cli-framework';
export type {
  ResolveBinOptions,
  SpawnSpec,
  CliFrameworkRecipeOptions,
  FrameworkBaseOptions,
} from './cli-framework';
export {
  importViteFromRoot,
  runViteBuild,
  startViteDev,
  startVitePreview,
} from './vite-api';
export type { ViteApiModule, ViteProgrammaticOpts } from './vite-api';
export {
  matrixRecipe,
  findWorkspaceRoot,
  workspacePackageSrcDirs,
  shouldIncludeWorkspaceDeps,
  appendWorkspaceHashInputs,
} from './matrix';
export type { MatrixCapableOptions, MatrixRecipeOptions } from './matrix';
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
} from './config-override';
