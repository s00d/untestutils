export {
  cleanupAll,
  addCleanup,
  removeCleanup,
} from './cleanup';

export { bumpUnitBootCounter } from './boot-counter';

export {
  clearHostState,
  clearTimersAndStubs,
  applyHostResetLayers,
  type HostResetOptions,
} from './host-reset';

export {
  type AppIsolation,
  type SetupEntryWindow,
  type DisposableApp,
  type RegisterSetupEntryOptions,
  WORKER_SETUP_PROP,
  WORKER_RESET_HOOK_PROP,
  disposeBestEffort,
  registerSetupEntry,
  resolveAppIsolation,
  invalidateWorkerSetup,
} from './setup-entry';

export {
  applyWorkerIsolationDefaults,
  type WorkerIsolationDefaultsInput,
  type WorkerIsolationDefaultsResult,
} from './isolation-defaults';
