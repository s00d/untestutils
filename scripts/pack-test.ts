import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'pathe';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PACK_PKGS = [
  'packages/core',
  'packages/nuxt',
  'packages/utils',
  'packages/vitest',
  'packages/playwright',
  'packages/perf',
  'packages/ai',
  'packages/cli',
  'packages/vitest-environment-untestutils',
  'packages/untestutils',
] as const;

const packTest = defineCommand({
  meta: {
    name: 'pack-test',
    description: 'pnpm pack scoped packages + facade and smoke-import from a temp consumer',
  },
  async run() {
    if (!existsSync(join(ROOT, 'pnpm-workspace.yaml'))) {
      consola.error('pack-test is for the untestutils monorepo only');
      process.exitCode = 1;
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), 'untestutils-pack-'));
    try {
      const deps: Record<string, string> = {};
      for (const rel of PACK_PKGS) {
        const pkgDir = join(ROOT, rel);
        const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8')) as {
          name: string;
        };
        const out = execSync(`pnpm pack --pack-destination ${JSON.stringify(dir)}`, {
          cwd: pkgDir,
          encoding: 'utf8',
        });
        const line = out
          .trim()
          .split('\n')
          .map((l) => l.trim())
          .reverse()
          .find((l) => l.endsWith('.tgz'));
        if (!line) throw new Error(`pnpm pack produced no tgz for ${pkg.name}`);
        const tgzPath = line.startsWith('/') ? line : join(dir, line);
        deps[pkg.name] = `file:${tgzPath}`;
        consola.info(`packed ${pkg.name} → ${tgzPath}`);
      }

      const consumer = join(dir, 'consumer');
      await mkdir(consumer);
      await writeFile(
        join(consumer, 'package.json'),
        JSON.stringify(
          {
            name: 'pack-consumer',
            type: 'module',
            private: true,
            dependencies: deps,
            pnpm: { overrides: deps },
          },
          null,
          2,
        ),
      );
      execSync('pnpm install --no-frozen-lockfile', { cwd: consumer, stdio: 'inherit' });
      const check = `
import { defineRecipes, staticDir, host } from 'untestutils'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
for (const id of [
  '@untestutils/core',
  'untestutils/vitest/plugin',
  'untestutils/playwright',
  'untestutils/command',
]) {
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

runMain(packTest);
