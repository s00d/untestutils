/**
 * Published shim so Vitest can resolve `environment: 'untestutils'`
 * via the conventional package name when nested under the facade tarball.
 * Prefer installing `vitest-environment-untestutils` (also a dependency of this package).
 */
export { default } from '@untestutils/nuxt/environment';
