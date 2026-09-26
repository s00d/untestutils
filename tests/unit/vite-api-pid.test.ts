import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { startViteDev } from '../../packages/core/src/drivers/vite-api';
import { adoptProcess } from '../../packages/core/src/process';
import {
  stopAllTargets,
  detachLiveTargetsForTests,
} from '../../packages/core/src/orchestrator';
import { TargetRegistry } from '../../packages/core/src/target-registry';
import { getFreePort } from '../../packages/core/src/ports';
import { findRepoRoot } from '../../packages/core/src/paths';

const fixtureRoot = join(findRepoRoot(), 'playground/fixtures/vite-spa');

describe('startViteDev pid reclaim', () => {
  afterEach(async () => {
    await stopAllTargets();
    detachLiveTargetsForTests();
  });

  test('startViteDev returns pid; stop kills child', async () => {
    const port = await getFreePort();
    const running = await startViteDev({
      root: fixtureRoot,
      port,
      host: '127.0.0.1',
      readyTimeoutMs: 60_000,
    });
    expect(typeof running.pid).toBe('number');
    expect(running.pid!).toBeGreaterThan(1);
    expect(adoptProcess(running.pid!).alive()).toBe(true);

    const res = await fetch(running.url!);
    expect(res.ok).toBe(true);

    await running.stop!();
    expect(adoptProcess(running.pid!).alive()).toBe(false);
  }, 90_000);

  test('stopAllTargets drains registry orphan vite child', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-vite-pid-'));
    const port = await getFreePort();
    const running = await startViteDev({
      root: fixtureRoot,
      port,
      host: '127.0.0.1',
      readyTimeoutMs: 60_000,
    });
    const pid = running.pid!;
    expect(adoptProcess(pid).alive()).toBe(true);

    const reg = new TargetRegistry(artifacts);
    await reg.set({
      id: 'vite-orphan',
      identity: 'vite-orphan',
      url: running.url,
      pid,
    });
    // Simulate fork: liveStops empty in main, only registry pid remains.
    detachLiveTargetsForTests();

    await stopAllTargets(artifacts);
    expect(adoptProcess(pid).alive()).toBe(false);
    expect(await reg.read()).toEqual({});
    await rm(artifacts, { recursive: true, force: true });
  }, 90_000);
});
