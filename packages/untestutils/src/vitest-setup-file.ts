/**
 * Vitest worker setupFiles entry.
 * Re-export a live binding so Rolldown cannot tree-shake the module empty
 * (`sideEffects: false` + unused `await import()` previously erased the setup).
 * Top-level await in `@untestutils/vitest/setup-file` still runs on load.
 */
export { applyWorkerSetup } from '@untestutils/vitest/setup-file';
