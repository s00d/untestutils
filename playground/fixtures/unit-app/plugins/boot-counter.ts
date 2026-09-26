/**
 * In-process boot marker for playground dogfood (restart.spec).
 * Cross-file CI counts use setupNuxt → bumpSharedNuxtBootCounter + UNTESTUTILS_BOOT_FILE.
 */
export default defineNuxtPlugin(() => {
  const g = globalThis as typeof globalThis & { __UT_BOOTS?: number };
  // Prefer setupNuxt counter when present; keep plugin as fallback for older builds.
  g.__UT_BOOTS = g.__UT_BOOTS ?? 0;
});
