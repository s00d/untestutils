import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { FileLock, atomicWriteJson, isReady, markReady } from '../../packages/core/src/lock';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

describe('FileLock', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'untestutils-lock-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('acquire and release', async () => {
    const lock = new FileLock(join(dir, 'a.lock'), 'a');
    await lock.acquire(5_000);
    expect(existsSync(join(dir, 'a.lock'))).toBe(true);
    await lock.release();
    expect(existsSync(join(dir, 'a.lock'))).toBe(false);
  });

  test('second lock waits then acquires after release', async () => {
    const a = new FileLock(join(dir, 'b.lock'), 'b');
    const b = new FileLock(join(dir, 'b.lock'), 'b');
    await a.acquire(5_000);
    const pending = b.acquire(5_000);
    await a.release();
    await pending;
    await b.release();
  });

  test('atomicWriteJson is readable', async () => {
    const path = join(dir, 'x.json');
    await atomicWriteJson(path, { ok: true });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ ok: true });
  });

  test('markReady', async () => {
    const ready = join(dir, '.ready');
    expect(await isReady(ready)).toBe(false);
    await markReady(ready);
    expect(await isReady(ready)).toBe(true);
  });

  test('steals stale lock from dead pid', async () => {
    const lockPath = join(dir, 'stale.lock');
    await mkdir(dir, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: 99999999,
        startedAt: Date.now() - 60_000,
        heartbeatAt: Date.now() - 60_000,
        identity: 'stale',
      }),
      'utf8',
    );
    const lock = new FileLock(lockPath, 'stale', 1_000);
    await lock.acquire(5_000);
    await lock.release();
  });
});
