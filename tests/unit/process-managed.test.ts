import { describe, expect, test, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
  adoptProcess,
  spawnManaged,
  processIo,
  processPlatform,
} from '../../packages/core/src/process';
import {
  stopAllTargets,
  detachLiveTargetsForTests,
} from '../../packages/core/src/orchestrator';
import { TargetRegistry } from '../../packages/core/src/target-registry';
import { getFreePort } from '../../packages/core/src/ports';

function waitReady(child: ReturnType<typeof spawn>, ms = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ready timeout')), ms);
    child.stdout?.on('data', (buf) => {
      if (String(buf).includes('ready')) {
        clearTimeout(t);
        resolve();
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`exited early ${code}`)));
  });
}

function spawnHttp(port: number, detached: boolean) {
  return spawn(
    process.execPath,
    [
      '-e',
      `require('node:http').createServer((_q,res)=>res.end('ok')).listen(${port},'127.0.0.1',()=>process.stdout.write('ready\\n'))`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], detached },
  );
}

describe('ManagedProcess / spawnManaged / adoptProcess', () => {
  afterEach(async () => {
    await stopAllTargets();
    detachLiveTargetsForTests();
  });

  test('adoptProcess(process) never sends negative pid', async () => {
    const calls: Array<{ pid: number; signal?: NodeJS.Signals | number }> = [];
    const realKill = processIo.kill;
    let alive = true;
    processIo.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      calls.push({ pid, signal });
      if (signal === 0) {
        if (!alive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
        return undefined as never;
      }
      if (pid < 0) throw new Error('process stop must not use negative pid');
      alive = false;
      return undefined as never;
    }) as typeof processIo.kill;

    try {
      await adoptProcess(55_001, 'process').stop();
      expect(calls.some((c) => c.pid < 0)).toBe(false);
      expect(calls.some((c) => c.pid === 55_001 && c.signal !== 0)).toBe(true);
    } finally {
      processIo.kill = realKill;
    }
  });

  test('adoptProcess(server) tries -pid first, falls back to +pid on ESRCH', async () => {
    const calls: number[] = [];
    const realKill = processIo.kill;
    let alive = true;
    processIo.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      if (signal === 0) {
        if (!alive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
        return undefined as never;
      }
      calls.push(pid);
      if (pid < 0) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      alive = false;
      return undefined as never;
    }) as typeof processIo.kill;

    try {
      await adoptProcess(66_002, 'server').stop();
      expect(calls[0]).toBe(-66_002);
      expect(calls).toContain(66_002);
    } finally {
      processIo.kill = realKill;
    }
  });

  test('dead pid is a no-op (no TERM/KILL)', async () => {
    const calls: Array<{ pid: number; signal?: NodeJS.Signals | number }> = [];
    const realKill = processIo.kill;
    processIo.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      calls.push({ pid, signal });
      if (signal === 0) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      return undefined as never;
    }) as typeof processIo.kill;

    try {
      await adoptProcess(77_003, 'process').stop();
      await adoptProcess(77_003, 'server').stop();
      expect(calls.every((c) => c.signal === 0)).toBe(true);
    } finally {
      processIo.kill = realKill;
    }
  });

  test('self pid and pid<=1 are no-ops', async () => {
    const realKill = processIo.kill;
    let term = 0;
    processIo.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      if (signal !== 0) term += 1;
      return realKill(pid, signal);
    }) as typeof processIo.kill;
    try {
      await adoptProcess(process.pid, 'process').stop();
      await adoptProcess(0, 'process').stop();
      await adoptProcess(1, 'process').stop();
      expect(term).toBe(0);
    } finally {
      processIo.kill = realKill;
    }
  });

  test('spawnManaged(server:false) leaves sibling alive', async () => {
    const portA = await getFreePort();
    const portB = await getFreePort();
    const a = spawnManaged(
      process.execPath,
      [
        '-e',
        `require('node:http').createServer((_q,res)=>res.end('ok')).listen(${portA},'127.0.0.1',()=>process.stdout.write('ready\\n'))`,
      ],
      { server: false, captureLogs: true },
    );
    const b = spawnManaged(
      process.execPath,
      [
        '-e',
        `require('node:http').createServer((_q,res)=>res.end('ok')).listen(${portB},'127.0.0.1',()=>process.stdout.write('ready\\n'))`,
      ],
      { server: false, captureLogs: true },
    );

    // wait until logs show ready
    const waitLog = async (m: typeof a) => {
      const t0 = Date.now();
      while (Date.now() - t0 < 5_000) {
        if (m.logs().includes('ready')) return;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error('ready timeout');
    };
    await waitLog(a);
    await waitLog(b);
    expect(a.alive()).toBe(true);
    expect(b.alive()).toBe(true);

    await a.stop();
    expect(a.alive()).toBe(false);
    expect(b.alive()).toBe(true);

    await b.stop();
  });

  test('spawnManaged(server) stops detached leader', async () => {
    const port = await getFreePort();
    const managed = spawnManaged(
      process.execPath,
      [
        '-e',
        `require('node:http').createServer((_q,res)=>res.end('ok')).listen(${port},'127.0.0.1',()=>process.stdout.write('ready\\n'))`,
      ],
      { server: true, captureLogs: true },
    );
    const t0 = Date.now();
    while (Date.now() - t0 < 5_000) {
      if (managed.logs().includes('ready')) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(managed.alive()).toBe(true);
    await managed.stop();
    expect(managed.alive()).toBe(false);
  });

  test('stopAllTargets stops live registry orphan (detached)', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-live-orphan-'));
    const port = await getFreePort();
    const child = spawnHttp(port, true);
    await waitReady(child);
    child.unref();
    const pid = child.pid!;
    const url = `http://127.0.0.1:${port}/`;

    const reg = new TargetRegistry(artifacts);
    await reg.set({ id: 'live-orphan', identity: 'x', url, pid });
    detachLiveTargetsForTests();

    expect(adoptProcess(pid).alive()).toBe(true);
    await stopAllTargets(artifacts);
    expect(adoptProcess(pid).alive()).toBe(false);
    expect(await reg.read()).toEqual({});
    await rm(artifacts, { recursive: true, force: true });
  });

  test('win32 adoptProcess(server) uses taskkill /T', async () => {
    const realPlatform = processPlatform.current;
    const realSpawn = processIo.spawn;
    const realKill = processIo.kill;
    const spawns: string[][] = [];
    processPlatform.current = () => 'win32';
    processIo.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      if (signal === 0) return undefined as never;
      return undefined as never;
    }) as typeof processIo.kill;
    processIo.spawn = ((cmd: string, args: string[]) => {
      spawns.push([cmd, ...args]);
      const fake = {
        on: (ev: string, cb: () => void) => {
          if (ev === 'exit') queueMicrotask(cb);
          return fake;
        },
      };
      return fake as unknown as ReturnType<typeof spawn>;
    }) as typeof processIo.spawn;

    try {
      await adoptProcess(88_004, 'server').stop();
      expect(spawns.some((a) => a[0] === 'taskkill' && a.includes('/T') && a.includes('88004'))).toBe(
        true,
      );
    } finally {
      processPlatform.current = realPlatform;
      processIo.spawn = realSpawn;
      processIo.kill = realKill;
    }
  });
});
