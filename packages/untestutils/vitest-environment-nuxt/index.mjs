/**
 * Drop-in alias so `environment: 'nuxt'` resolves like `@nuxt/test-utils`.
 * Implementation is the untestutils Vitest environment.
 */
export { default } from '../dist/vitest-environment.mjs';
