import { describe, expect, test, beforeEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'pathe';
import { tmpdir } from 'node:os';
import {
  clearRegisteredRecipes,
  defineRecipe,
  ensurePrepared,
  resetRecipeBindings,
} from '@untestutils/core';
import { detachLiveTargetsForTests } from '../../packages/core/src/orchestrator';

describe('warm cache artifact verify', () => {
  beforeEach(() => {
    clearRegisteredRecipes();
    resetRecipeBindings();
    detachLiveTargetsForTests();
  });

  test('missing app build output after warm hit forces rebuild', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-warm-verify-art-'));
    const app = await mkdtemp(join(tmpdir(), 'ut-warm-verify-app-'));
    const distIndex = join(app, 'dist-override', 'index.html');
    let prepares = 0;

    const recipe = defineRecipe({
      id: 'warm-vite-like',
      share: 'prepare-only',
      prepare: async () => {
        prepares += 1;
        await mkdir(join(app, 'dist-override'), { recursive: true });
        await writeFile(distIndex, '<html>ok</html>');
      },
      verifyArtifact: async () => {
        if (!existsSync(distIndex)) {
          throw new Error(`[test] missing ${distIndex}`);
        }
      },
      start: async () => ({ kind: 'dir', dir: app }),
    });

    try {
      await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(prepares).toBe(1);
      expect(existsSync(distIndex)).toBe(true);

      await rm(join(app, 'dist-override'), { recursive: true, force: true });
      expect(existsSync(distIndex)).toBe(false);

      await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(prepares).toBe(2);
      expect(existsSync(distIndex)).toBe(true);
    } finally {
      await rm(artifacts, { recursive: true, force: true });
      await rm(app, { recursive: true, force: true });
    }
  });
});
