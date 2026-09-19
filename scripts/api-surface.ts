import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const apiSurface = defineCommand({
  meta: {
    name: 'api-surface',
    description: 'Check public exports snapshot of the untestutils facade',
  },
  args: {
    update: {
      type: 'boolean',
      description: 'Update snapshot',
      default: false,
      alias: 'u',
    },
  },
  async run({ args }) {
    if (!existsSync(join(ROOT, 'pnpm-workspace.yaml'))) {
      consola.error('api-surface is for the untestutils monorepo only');
      process.exitCode = 1;
      return;
    }
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'packages/untestutils/package.json'), 'utf8'),
    ) as { exports: Record<string, unknown> };
    const keys = Object.keys(pkg.exports).sort();
    const snapshotPath = resolve(ROOT, 'tests/dist/api-surface.snap.json');
    const update = Boolean(args.update);

    if (update || !existsSync(snapshotPath)) {
      writeFileSync(snapshotPath, `${JSON.stringify(keys, null, 2)}\n`);
      consola.success(`updated ${snapshotPath}`);
      return;
    }

    const expected = JSON.parse(readFileSync(snapshotPath, 'utf8')) as string[];
    if (JSON.stringify(expected) !== JSON.stringify(keys)) {
      consola.error('API surface drift. Run: pnpm api:surface:update');
      consola.error('expected', expected);
      consola.error('actual', keys);
      process.exitCode = 1;
      return;
    }
    consola.success(`api surface ok (${keys.length} exports)`);
  },
});

process.argv = process.argv.filter((arg) => arg !== '--');
runMain(apiSurface);
