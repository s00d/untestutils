import { defineCommand } from 'citty';
import { consola } from 'consola';
import { execSync } from 'node:child_process';
import { findMonorepoRoot } from '../utils/workspace';

const BUILD_ORDER = [
  '@untestutils/core',
  '@untestutils/utils',
  '@untestutils/perf',
  '@untestutils/drivers',
  '@untestutils/nuxt',
  '@untestutils/vitest',
  '@untestutils/playwright',
  '@untestutils/ai',
  '@untestutils/vite',
  '@untestutils/next',
  '@untestutils/astro',
  '@untestutils/sveltekit',
  '@untestutils/runtime',
  '@untestutils/module',
  '@untestutils/config',
  '@untestutils/cli',
  'untestutils',
];

export const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Build monorepo packages in dependency order',
  },
  async run() {
    const root = findMonorepoRoot();
    if (!root) {
      consola.error('build is for the untestutils monorepo only');
      process.exitCode = 1;
      return;
    }
    for (const name of BUILD_ORDER) {
      consola.info(`>>> build ${name}`);
      execSync(`pnpm --filter ${name} run build`, { cwd: root, stdio: 'inherit' });
    }
    consola.success('Build finished');
  },
});
