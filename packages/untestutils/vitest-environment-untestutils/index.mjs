/**
 * Published shim so Vitest can resolve `environment: 'untestutils'`
 * via the conventional package name `vitest-environment-untestutils`.
 * Implementation lives in the facade bundle.
 */
export { default } from '../dist/vitest-environment.mjs';
