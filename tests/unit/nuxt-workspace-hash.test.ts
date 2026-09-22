import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { computeIdentity } from '@untestutils/core';
import { nuxt, _internals } from '@untestutils/nuxt';
import { resetRecipeBindings, clearRegisteredRecipes, stopAllTargets } from '@untestutils/core';

/**
 * Module monorepos (e.g. nuxt-i18n-next) keep the Nuxt module in workspace-root
 * src/ while fixtures live under test/fixtures and import ../../../src/module.
 * Prepare identity must include that root src/, not only packages/NAME/src.
 */
describe('nuxt workspace root src hash', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  test('resolveHashInputs includes workspace root src/ alongside packages/*/src', async () => {
    const ws = await mkdtemp(join(tmpdir(), 'ut-ws-src-'));
    try {
      await writeFile(join(ws, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      await mkdir(join(ws, 'packages', 'aux', 'src'), { recursive: true });
      await writeFile(join(ws, 'packages', 'aux', 'src', 'x.ts'), 'export const x = 1\n');
      await mkdir(join(ws, 'src'), { recursive: true });
      await writeFile(join(ws, 'src', 'module.ts'), 'export default () => ({})\n');
      const fixture = join(ws, 'apps', 'fixture');
      await mkdir(fixture, { recursive: true });
      await writeFile(join(fixture, 'nuxt.config.ts'), 'export default {}\n');

      const inputs = await _internals.resolveHashInputs({ root: fixture }, fixture);
      expect(inputs.map((p) => p.replace(/\\/g, '/'))).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/[/\\]packages[/\\]aux[/\\]src$/),
          expect.stringMatching(/[/\\]src$/),
        ]),
      );
      // Prefer exact path when possible
      expect(inputs).toContain(join(ws, 'src'));
      expect(inputs).toContain(join(ws, 'packages', 'aux', 'src'));
    } finally {
      await rm(ws, { recursive: true, force: true });
    }
  });

  test('identity changes when only workspace root src/module.ts changes', async () => {
    const ws = await mkdtemp(join(tmpdir(), 'ut-ws-id-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-ws-art-'));
    try {
      await writeFile(join(ws, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      await mkdir(join(ws, 'packages', 'aux', 'src'), { recursive: true });
      await writeFile(join(ws, 'packages', 'aux', 'src', 'x.ts'), 'export const x = 1\n');
      await mkdir(join(ws, 'src'), { recursive: true });
      await writeFile(join(ws, 'src', 'module.ts'), 'export default () => ({ /* v1 */ })\n');
      const fixture = join(ws, 'apps', 'fixture');
      await mkdir(fixture, { recursive: true });
      await writeFile(join(fixture, 'nuxt.config.ts'), 'export default {}\n');

      const recipe = nuxt({ id: 'fixture-app', root: fixture, run: 'server' });
      const h1 = (await computeIdentity(recipe, artifacts, fixture)).hash;
      await writeFile(join(ws, 'src', 'module.ts'), 'export default () => ({ /* v2 */ })\n');
      const h2 = (await computeIdentity(recipe, artifacts, fixture)).hash;
      expect(h1).not.toBe(h2);
    } finally {
      await rm(ws, { recursive: true, force: true });
      await rm(artifacts, { recursive: true, force: true });
    }
  });
});
