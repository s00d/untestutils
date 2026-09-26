import { describe, expect, test, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { defineRecipe } from '../../packages/core/src/recipes';
import { clearRegisteredRecipes } from '../../packages/core/src/recipes';
import { resetRecipeBindings } from '../../packages/core/src/identity';
import {
  ensurePrepared,
  stopAllTargets,
  detachLiveTargetsForTests,
} from '../../packages/core/src/orchestrator';
import { TargetRegistry } from '../../packages/core/src/target-registry';
import { getFreePort } from '../../packages/core/src/ports';
import { adoptProcess, processIo } from '../../packages/core/src/process';

describe('orchestrator / registry e2e lifecycle', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
    detachLiveTargetsForTests();
  });

  test('stopAllTargets kills registry pid after crash (orphan reclaim)', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-orphan-'));
    const port = await getFreePort();
    const server = createServer((_req, res) => res.end('alive'));
    await new Promise<void>((resolve, reject) => {
      server.listen(port, '127.0.0.1', () => resolve());
      server.once('error', reject);
    });
    // Fake orphan pid (must not be process.pid — adoptProcess guards that).
    const orphanPid = 424_242;
    const url = `http://127.0.0.1:${port}/`;

    const reg = new TargetRegistry(artifacts);
    await reg.set({
      id: 'orphan-spa',
      identity: 'orphan-id',
      url,
      pid: orphanPid,
      dir: artifacts,
    });
    detachLiveTargetsForTests();

    const killed: number[] = [];
    const realKill = processIo.kill;
    processIo.kill = ((target: number, signal?: NodeJS.Signals | number) => {
      if (signal === 0) {
        if (Math.abs(target) === orphanPid) return undefined as never;
        return realKill(target, 0);
      }
      killed.push(target);
      if (Math.abs(target) === orphanPid) {
        void new Promise<void>((r) => server.close(() => r()));
        return undefined as never;
      }
      return realKill(target, signal);
    }) as typeof processIo.kill;

    try {
      await stopAllTargets(artifacts);
      expect(killed.some((p) => Math.abs(p) === orphanPid)).toBe(true);
      expect(await reg.read()).toEqual({});
    } finally {
      processIo.kill = realKill;
      await new Promise<void>((r) => server.close(() => r())).catch(() => {});
      await rm(artifacts, { recursive: true, force: true });
    }
  });

  test('reuse after dead pid does not attach to stale URL', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-stale-'));
    const deadPort = await getFreePort();
    const deadUrl = `http://127.0.0.1:${deadPort}/`;

    // Registry points at a dead url + dead pid.
    const reg = new TargetRegistry(artifacts);
    await reg.set({
      id: 'stale-spa',
      identity: 'will-mismatch',
      url: deadUrl,
      pid: 999_999_999,
    });

    expect(adoptProcess(999_999_999).alive()).toBe(false);

    let starts = 0;
    const recipe = defineRecipe({
      id: 'stale-spa',
      start: async ({ port }) => {
        starts += 1;
        const s = createServer((_q, res) => res.end(`fresh-${starts}`));
        await new Promise<void>((r) => s.listen(port, '127.0.0.1', () => r()));
        return {
          kind: 'url' as const,
          url: `http://127.0.0.1:${port}/`,
          // Placeholder >1 and !== process.pid (reclaimable to fail-closed / shouldSkipPid).
          pid: 880_002,
          stop: () => new Promise<void>((r) => s.close(() => r())),
        };
      },
    });

    const prep = await ensurePrepared(recipe, { artifactsRoot: artifacts });
    expect(starts).toBe(1);
    expect('url' in prep.running && prep.running.url).not.toBe(deadUrl);
    expect('url' in prep.running && prep.running.url).toMatch(/127\.0\.0\.1/);

    await stopAllTargets(artifacts);
    await rm(artifacts, { recursive: true, force: true });
  });

  test('fail mid-start does not leave liveStops half-registered', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-failstart-'));
    const recipe = defineRecipe({
      id: 'fail-mid',
      start: async () => {
        throw new Error('start boom');
      },
    });

    await expect(ensurePrepared(recipe, { artifactsRoot: artifacts })).rejects.toThrow(
      'start boom',
    );

    // Teardown must be safe (no throw) even when start never registered.
    await expect(stopAllTargets(artifacts)).resolves.toBeUndefined();
    await rm(artifacts, { recursive: true, force: true });
  });

  test('replaceRegistryEntry kills previous live pid when starting fresh', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-replace-'));
    const killed: number[] = [];
    const realKill = processIo.kill;

    processIo.kill = ((target: number, signal?: NodeJS.Signals | number) => {
      if (signal === 0) {
        if (target === 111_222) return undefined as never;
        return realKill(target, 0);
      }
      killed.push(target);
      return undefined as never;
    }) as typeof processIo.kill;

    try {
      const reg = new TargetRegistry(artifacts);
      // Dead URL forces re-start; mocked-alive pid must be killed on replace.
      await reg.set({
        id: 'swap',
        identity: 'stale-identity',
        url: 'http://127.0.0.1:1/',
        pid: 111_222,
        dir: artifacts,
      });

      const recipe = defineRecipe({
        id: 'swap',
        share: 'always',
        start: async ({ port }) => {
          const s = createServer((_q, res) => res.end('fresh'));
          await new Promise<void>((r) => s.listen(port, '127.0.0.1', () => r()));
          return {
            kind: 'url' as const,
            url: `http://127.0.0.1:${port}/`,
            pid: 333_444,
            stop: () => new Promise<void>((r) => s.close(() => r())),
          };
        },
      });

      await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(killed.some((p) => Math.abs(p) === 111_222)).toBe(true);
    } finally {
      processIo.kill = realKill;
      await stopAllTargets(artifacts);
      await rm(artifacts, { recursive: true, force: true });
    }
  });
});
