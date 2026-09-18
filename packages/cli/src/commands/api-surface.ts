import { defineCommand } from 'citty';
import { consola } from 'consola';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'pathe';
import { findMonorepoRoot } from '../utils/workspace';

export const apiSurfaceCommand = defineCommand({
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
    const root = findMonorepoRoot();
    if (!root) {
      consola.error('api-surface is for the untestutils monorepo only');
      process.exitCode = 1;
      return;
    }
    const pkg = JSON.parse(
      readFileSync(join(root, 'packages/untestutils/package.json'), 'utf8'),
    ) as { exports: Record<string, unknown> };
    const keys = Object.keys(pkg.exports).sort();
    const snapshotPath = resolve(root, 'tests/dist/api-surface.snap.json');
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
