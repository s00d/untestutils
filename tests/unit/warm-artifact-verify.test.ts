import { describe, expect, test, beforeEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'pathe';
import { tmpdir } from 'node:os';
import {
  clearRegisteredRecipes,
  defineRecipe,
  ensurePrepared,
  resetRecipeBindings,
  TargetRegistry,
} from '@untestutils/core';
import { detachLiveTargetsForTests, stopAllTargets } from '../../packages/core/src/orchestrator';

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

  test('live target with invalid artifact is stopped and rebuilt', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-warm-live-art-'));
    const app = await mkdtemp(join(tmpdir(), 'ut-warm-live-app-'));
    const marker = join(app, 'MARK');
    let prepares = 0;
    let stops = 0;

    const recipe = defineRecipe({
      id: 'warm-live',
      share: 'always',
      prepare: async () => {
        prepares += 1;
        await writeFile(marker, 'ok');
      },
      verifyArtifact: async () => {
        if (!existsSync(marker)) throw new Error('[test] missing MARK');
      },
      start: async ({ port }) => {
        const server = createServer((_req, res) => {
          res.writeHead(200);
          res.end('ok');
        });
        await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
        return {
          kind: 'url',
          url: `http://127.0.0.1:${port}/`,
          // In-process server — placeholder pid satisfies fail-closed share:always guard.
          pid: 880_001,
          stop: async () => {
            stops += 1;
            await new Promise<void>((resolve, reject) =>
              server.close((err) => (err ? reject(err) : resolve())),
            );
          },
        };
      },
    });

    try {
      await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(prepares).toBe(1);

      // Second prepare reuses live; then delete artifact and prepare again.
      await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(prepares).toBe(1);

      await rm(marker, { force: true });
      await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(prepares).toBe(2);
      expect(stops).toBeGreaterThanOrEqual(1);
      expect(existsSync(marker)).toBe(true);
    } finally {
      await stopAllTargets(artifacts);
      await rm(artifacts, { recursive: true, force: true });
      await rm(app, { recursive: true, force: true });
    }
  });

  test('registry reuse skips when verifyArtifact fails', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-warm-reg-art-'));
    const app = await mkdtemp(join(tmpdir(), 'ut-warm-reg-app-'));
    const marker = join(app, 'MARK');
    let prepares = 0;

    const server = createServer((_req, res) => {
      res.writeHead(200);
      res.end('alive');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no addr');
    const url = `http://127.0.0.1:${addr.port}/`;

    const registry = new TargetRegistry(artifacts);
    await writeFile(marker, 'ok');

    // Seed warm store + registry as if another worker left a live URL.
    const recipe = defineRecipe({
      id: 'warm-reg',
      share: 'always',
      hashInputs: async () => ['warm-reg-stable-v1'],
      prepare: async () => {
        prepares += 1;
        await writeFile(marker, 'ok');
      },
      verifyArtifact: async () => {
        if (!existsSync(marker)) throw new Error('[test] missing MARK');
      },
      start: async () => ({
        kind: 'url',
        url,
        pid: 880_002,
        stop: async () => {},
      }),
    });

    try {
      // First prepare commits warm + starts (will also register).
      const first = await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(prepares).toBe(1);
      expect(first.running.kind === 'url' || first.running.kind === 'url+dir').toBe(true);

      detachLiveTargetsForTests();
      await rm(marker, { force: true });

      // With live detached, tryReuseRegistry path runs; verify fails → prepare again.
      await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(prepares).toBe(2);
      expect(existsSync(marker)).toBe(true);
    } finally {
      await stopAllTargets(artifacts);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(artifacts, { recursive: true, force: true });
      await rm(app, { recursive: true, force: true });
    }
  });
});
