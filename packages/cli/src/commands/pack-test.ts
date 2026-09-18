import { defineCommand } from 'citty';
import { consola } from 'consola';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { execSync } from 'node:child_process';
import { findMonorepoRoot } from '../utils/workspace';

export const packTestCommand = defineCommand({
  meta: {
    name: 'pack-test',
    description: 'pnpm pack the facade and smoke-import from a temp consumer',
  },
  async run() {
    const root = findMonorepoRoot();
    if (!root) {
      consola.error('pack-test is for the untestutils monorepo only');
      process.exitCode = 1;
      return;
    }
    const facade = join(root, 'packages/untestutils');
    const dir = await mkdtemp(join(tmpdir(), 'untestutils-pack-'));
    try {
      execSync(`pnpm pack --pack-destination ${JSON.stringify(dir)}`, {
        cwd: facade,
        stdio: 'inherit',
      });
      const tgz = execSync('ls *.tgz', { cwd: dir, encoding: 'utf8' }).trim().split('\n')[0];
      const consumer = join(dir, 'consumer');
      await mkdir(consumer);
      await writeFile(
        join(consumer, 'package.json'),
        JSON.stringify(
          {
            name: 'pack-consumer',
            type: 'module',
            private: true,
            dependencies: {
              untestutils: `file:${join(dir, tgz!)}`,
            },
          },
          null,
          2,
        ),
      );
      execSync('pnpm install', { cwd: consumer, stdio: 'inherit' });
      const check = `
import { defineRecipes, staticDir, host } from 'untestutils'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
for (const id of ['untestutils/vitest/plugin', 'untestutils/playwright', 'untestutils/command']) {
  req.resolve(id)
  console.log('ok', id)
}
console.log('pack smoke ok', typeof defineRecipes, typeof staticDir, typeof host)
`;
      await writeFile(join(consumer, 'check.mjs'), check);
      execSync('node check.mjs', { cwd: consumer, stdio: 'inherit' });
      consola.success('test:pack passed');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});
