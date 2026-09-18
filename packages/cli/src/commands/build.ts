import { defineCommand } from 'citty';
import { consola } from 'consola';
import { execSync } from 'node:child_process';
import { findMonorepoRoot } from '../utils/workspace';

/** Only the published facade is built. Private workspace packages are consumed from src. */
const BUILD_ORDER = ['untestutils'] as const;

export const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Build the published untestutils facade (private packages stay on src)',
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
