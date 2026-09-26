import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineVitestProject } from 'untestutils/config';

const require = createRequire(import.meta.url);
const nuxtPkgRoot = dirname(require.resolve('@untestutils/nuxt/package.json')).replaceAll(
  '\\',
  '/',
);

/**
 * Isolate-setup fixture (nuxt/test-utils#1821 shape):
 * Vite transform counts setupNuxt per worker and optionally fails first boot.
 */
export default defineVitestProject({
  test: {
    name: 'isolate-setup',
    include: ['isolate-setup/**/*.{test,spec}.ts'],
    maxWorkers: Number(process.env.UT_MAX_WORKERS || 1),
    pool: 'threads',
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('./fixtures/unit-app', import.meta.url)),
        domEnvironment: 'happy-dom',
        appIsolation: process.env.UT_APP_ISOLATION === 'file' ? 'file' : 'worker',
        resetBetweenTests: true,
      },
    },
  },
  plugins: [
    {
      name: 'fixtures:isolate-setup:count-setup-nuxt',
      enforce: 'pre' as const,
      transform(code: string, id: string) {
        const normalized = id.replaceAll('\\', '/');
        const isNuxtSetup =
          (normalized.includes('/runtime/shared/nuxt.') ||
            normalized.endsWith('/shared/nuxt.mjs') ||
            normalized.endsWith('/shared/nuxt.ts')) &&
          (normalized.includes(nuxtPkgRoot) ||
            normalized.includes('/packages/nuxt/') ||
            normalized.includes('/@untestutils/nuxt/'));
        if (!isNuxtSetup) return;
        if (!code.includes('export async function setupNuxt')) return;

        return (
          code.replace(/export async function setupNuxt/, 'async function _setupNuxt') +
          `
export async function setupNuxt(...args) {
  const win = globalThis.window
  if (win) {
    win.__setup_calls__ = (win.__setup_calls__ ?? 0) + 1
  }
  const workerId = import.meta.env.VITEST_POOL_ID ?? import.meta.env.VITEST_WORKER_ID ?? 'undefined'
  const line = \`### setupNuxt called ### \${win?.__setup_calls__ ?? 0}:\${workerId}\`
  console.log(line)
  const logFile = process.env.UT_SETUP_LOG_FILE
  if (logFile) {
    try {
      const { appendFileSync } = await import('node:fs')
      appendFileSync(logFile, line + '\\n')
    } catch { /* ignore */ }
  }

  const pattern = process.env.ERROR_TEST_PATTERN
  if ((win?.__setup_calls__ ?? 0) === 1) {
    if (pattern === 'before') {
      throw new Error('#### setupNuxt failed before ###')
    }
    if (pattern === 'after') {
      await _setupNuxt(...args)
      throw new Error('#### setupNuxt failed after ###')
    }
  }
  return _setupNuxt(...args)
}
`
        );
      },
    },
  ],
});
