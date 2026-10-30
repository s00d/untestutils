import { afterAll, afterEach, describe, expect, test as vtest, vi } from 'vitest';
import { AsyncLocalStorage } from 'node:async_hooks';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
  ArtifactStore,
  FileLock,
  TargetRegistry,
  beginRun,
  endRun,
  ensureRunId,
  runDir,
  clearRegisteredRecipes,
  defineRecipe,
  ensurePrepared,
  getFreePort,
  isAddressInUseError,
  lockPathFor,
  prewarmTargets,
  pruneBuilds,
  resetRecipeBindings,
  resolveGcKeep,
  stopAllTargets,
} from '@untestutils/core';
import { adoptProcess, processStartToken, spawnManaged } from '../../packages/core/src/process';
import {
  createGoto,
  overrideHarnessValue,
  resolveBuildTimeout,
  test as harnessTest,
} from '../../packages/vitest/src/fixtures';
import {
  INFRA_ERROR_PATTERN,
  RetryReporter,
  infraRetry,
  supportsRetryCondition,
  untestutils,
} from '../../packages/vitest/src/plugin';

const tmp = (p: string) => mkdtemp(join(tmpdir(), `untestutils-${p}-`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('build cache GC (pruneBuilds)', () => {
  let root: string;
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function build(identity: string, usedAt: number, ready = true) {
    const store = new ArtifactStore(root);
    await store.ensureDir(identity);
    if (ready) await store.commit(identity, 'h');
    await writeFile(store.lastUsedFile(identity), String(usedAt));
  }

  vtest('keeps newest N per recipe + this run, drops the rest', async () => {
    root = await tmp('gc');
    const now = Date.now();
    await build('site-aaaaaaaaaaaa', now - 5000);
    await build('site-bbbbbbbbbbbb', now - 4000);
    await build('site-cccccccccccc', now - 3000);
    await build('site-dddddddddddd', now - 2000);
    await build('other-eeeeeeeeeeee', now - 9000);
    await mkdir(join(root, 'builds', 'not-an-identity'), { recursive: true });

    const res = await pruneBuilds(root, { keep: 2, usedSince: now + 1 });
    expect(res.removed.sort()).toEqual(['site-aaaaaaaaaaaa', 'site-bbbbbbbbbbbb']);
    expect(existsSync(join(root, 'builds', 'site-dddddddddddd'))).toBe(true);
    expect(existsSync(join(root, 'builds', 'other-eeeeeeeeeeee'))).toBe(true);
    expect(existsSync(join(root, 'builds', 'not-an-identity'))).toBe(true);
  });

  vtest('never removes a build used this run, in flight, or locked', async () => {
    root = await tmp('gc2');
    const now = Date.now();
    await build('app-111111111111', now - 1000); // newest → kept by keep:1
    await build('app-222222222222', now - 500_000); // used "this run" via usedSince
    await build('app-333333333333', now - 900_000); // locked by a live builder
    await build('app-444444444444', now, false); // no .ready, fresh → in-flight
    await build('app-555555555555', now - 3_600_000, false); // abandoned partial
    const lock = new FileLock(lockPathFor(root, 'app-333333333333'), 'app-333333333333');
    await lock.acquire(1000);
    try {
      const res = await pruneBuilds(root, { keep: 1, usedSince: now - 600_000 });
      expect(res.removed).toEqual(['app-555555555555']);
      expect(res.kept.sort()).toEqual([
        'app-111111111111',
        'app-222222222222',
        'app-333333333333',
        'app-444444444444',
      ]);
    } finally {
      await lock.release();
    }
  });

  vtest('ensurePrepared stamps .last-used; UNTESTUTILS_GC parsing', async () => {
    root = await tmp('gc3');
    const recipe = defineRecipe({
      id: 'stamp',
      share: 'prepare-only',
      start: async () => ({}) as never,
    });
    const prepared = await ensurePrepared(recipe, { artifactsRoot: root });
    const used = Number(
      await readFile(new ArtifactStore(root).lastUsedFile(prepared.identity), 'utf8'),
    );
    expect(Date.now() - used).toBeLessThan(5000);
    resetRecipeBindings();

    const prev = process.env.UNTESTUTILS_GC;
    try {
      delete process.env.UNTESTUTILS_GC;
      expect(resolveGcKeep()).toBe(2);
      process.env.UNTESTUTILS_GC = '0';
      expect(resolveGcKeep()).toBeUndefined();
      process.env.UNTESTUTILS_GC = '5';
      expect(resolveGcKeep()).toBe(5);
    } finally {
      if (prev === undefined) delete process.env.UNTESTUTILS_GC;
      else process.env.UNTESTUTILS_GC = prev;
    }
  });
});

describe('heartbeat-aware FileLock', () => {
  let dir: string;
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  vtest('keeps waiting past timeoutMs while the holder heartbeats', async () => {
    dir = await tmp('lockhb');
    const path = join(dir, 'busy.lock');
    const holder = () =>
      writeFile(
        path,
        JSON.stringify({
          pid: process.pid,
          startedAt: Date.now() - 60_000,
          heartbeatAt: Date.now(),
          identity: 'busy',
          token: 'other',
        }),
      );
    await holder();
    const beat = setInterval(() => void holder(), 100);
    const started = Date.now();
    const waiting = new FileLock(path, 'busy').acquire(300);
    await sleep(900);
    clearInterval(beat);
    await unlink(path);
    await waiting;
    expect(Date.now() - started).toBeGreaterThan(800);
  });

  vtest('fails with holder details when the heartbeat stops', async () => {
    dir = await tmp('lockhung');
    const path = join(dir, 'hung.lock');
    await writeFile(
      path,
      JSON.stringify({
        pid: process.pid,
        startedAt: Date.now() - 120_000,
        heartbeatAt: Date.now() - 60_000,
        identity: 'hung',
        token: 'other',
      }),
    );
    await expect(new FileLock(path, 'hung').acquire(300)).rejects.toThrow(
      /holder pid=\d+ \(alive\) identity=hung.*last heartbeat 60s ago/,
    );
  });

  vtest('tryAcquire is non-blocking', async () => {
    dir = await tmp('locktry');
    const path = join(dir, 't.lock');
    const a = new FileLock(path, 't');
    const b = new FileLock(path, 't');
    expect(await a.tryAcquire()).toBe(true);
    expect(await b.tryAcquire()).toBe(false);
    await a.release();
    expect(await b.tryAcquire()).toBe(true);
    await b.release();
  });
});

describe('parallel prewarm', () => {
  let root: string;
  afterEach(async () => {
    clearRegisteredRecipes();
    resetRecipeBindings();
    await rm(root, { recursive: true, force: true });
  });

  const slow = (id: string, track: { now: number; max: number; ran: string[] }, fail = false) =>
    defineRecipe({
      id,
      share: 'prepare-only',
      prepare: async () => {
        track.ran.push(id);
        track.max = Math.max(track.max, ++track.now);
        await sleep(150);
        track.now--;
        if (fail) throw new Error(`boom ${id}`);
      },
      start: async () => ({}) as never,
    });

  vtest('runs up to `concurrency` recipes at once', async () => {
    root = await tmp('prewarm');
    const track = { now: 0, max: 0, ran: [] as string[] };
    const started = Date.now();
    await prewarmTargets(
      ['p1', 'p2', 'p3', 'p4'].map((id) => slow(id, track)),
      { artifactsRoot: root, concurrency: 2 },
    );
    expect(track.max).toBe(2);
    expect(track.ran).toHaveLength(4);
    expect(Date.now() - started).toBeLessThan(4 * 150);
  });

  vtest('stops taking new recipes after a failure and rethrows it', async () => {
    root = await tmp('prewarmfail');
    const track = { now: 0, max: 0, ran: [] as string[] };
    await expect(
      prewarmTargets([slow('f1', track, true), slow('f2', track), slow('f3', track)], {
        artifactsRoot: root,
        concurrency: 1,
      }),
    ).rejects.toThrow('boom f1');
    expect(track.ran).toEqual(['f1']);
  });
});

describe('ports', () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root) {
      await stopAllTargets(root);
      await rm(root, { recursive: true, force: true });
    }
    root = undefined;
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  vtest('getFreePort never repeats a port within the process', async () => {
    const ports = await Promise.all(Array.from({ length: 20 }, () => getFreePort()));
    expect(new Set(ports).size).toBe(ports.length);
  });

  vtest('isAddressInUseError looks at code, message and cause', () => {
    expect(isAddressInUseError(Object.assign(new Error('x'), { code: 'EADDRINUSE' }))).toBe(true);
    expect(isAddressInUseError(new Error('ready failed\nError: listen EADDRINUSE: :::3000'))).toBe(
      true,
    );
    expect(
      isAddressInUseError(new Error('wrap', { cause: new Error('address already in use') })),
    ).toBe(true);
    expect(isAddressInUseError(new Error('ECONNREFUSED'))).toBe(false);
  });

  vtest('start is retried on a fresh port after EADDRINUSE', async () => {
    root = await tmp('portretry');
    const ports: number[] = [];
    const recipe = defineRecipe({
      id: 'retry-port',
      start: async ({ port }) => {
        ports.push(port);
        if (ports.length === 1) throw new Error('listen EADDRINUSE: address already in use');
        return { kind: 'url', url: `http://127.0.0.1:${port}/` };
      },
      ready: async () => {},
    });
    const prepared = await ensurePrepared(recipe, { artifactsRoot: root });
    expect(ports).toHaveLength(2);
    expect(ports[0]).not.toBe(ports[1]);
    expect(prepared.running).toMatchObject({ url: `http://127.0.0.1:${ports[1]}/` });
  });
});

describe.skipIf(process.platform === 'win32')('process identity + run-scoped registry', () => {
  let root: string;
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const sleeper = () =>
    spawnManaged(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { captureLogs: true });

  vtest('adoptProcess refuses a pid whose start token changed (pid reuse)', async () => {
    root = await tmp('pid');
    const child = sleeper();
    try {
      await sleep(100);
      const token = processStartToken(child.pid);
      expect(token).toBeTruthy();
      expect(adoptProcess(child.pid!, 'server', token).alive()).toBe(true);
      const reused = adoptProcess(child.pid!, 'server', 'Thu Jan  1 00:00:00 1970');
      expect(reused.alive()).toBe(false);
      await reused.stop({ graceMs: 100 });
      expect(child.alive()).toBe(true);
    } finally {
      await child.stop();
    }
  });

  vtest('registry lives under run/; teardown reclaims legacy targets.json', async () => {
    root = await tmp('legacy');
    expect(new TargetRegistry(root).filePath).toBe(join(root, 'run', 'targets.json'));
    expect(lockPathFor(root, 'x')).toBe(join(root, 'run', 'locks', 'x.lock'));

    const child = sleeper();
    await sleep(100);
    await writeFile(
      join(root, 'targets.json'),
      JSON.stringify({ old: { id: 'old', identity: 'old', pid: child.pid } }),
    );
    await stopAllTargets(root, { graceMs: 200 });
    expect(child.alive()).toBe(false);
    expect(existsSync(join(root, 'targets.json'))).toBe(false);
  });

  vtest('teardown skips a registry pid that now belongs to another process', async () => {
    root = await tmp('reuse');
    const child = sleeper();
    try {
      await sleep(100);
      await new TargetRegistry(root).set({
        id: 'r',
        identity: 'r',
        pid: child.pid,
        pidStart: 'Thu Jan  1 00:00:00 1970',
      });
      await stopAllTargets(root, { graceMs: 200 });
      expect(child.alive()).toBe(true);
    } finally {
      await child.stop();
    }
  });
});

describe('goto hydration', () => {
  const fakePage = (opts: { nuxt: boolean; hydrates: boolean }) => {
    const calls = { wait: 0 };
    const page = {
      url: () => 'http://127.0.0.1:9/x',
      goto: async () => null,
      evaluate: async (fn: () => unknown) =>
        String(fn).includes('__NUXT_DATA__') ? opts.nuxt : 'isHydrating=true',
      waitForFunction: async () => {
        calls.wait++;
        if (!opts.hydrates) throw new Error('Timeout 30000ms exceeded');
      },
    } as any;
    return { page, calls };
  };

  vtest('strict: a Nuxt page that never hydrates fails with a clear error', async () => {
    const { page } = fakePage({ nuxt: true, hydrates: false });
    await expect(createGoto(page, 'http://127.0.0.1:9/', 'strict')('/x')).rejects.toThrow(
      /goto\(http:\/\/127\.0\.0\.1:9\/x\): Nuxt hydration not ready within 30000ms \(isHydrating=true\)/,
    );
  });

  vtest('strict: non-Nuxt pages skip the hydration wait', async () => {
    const { page, calls } = fakePage({ nuxt: false, hydrates: false });
    await createGoto(page, 'http://127.0.0.1:9/', 'strict')('/x');
    expect(calls.wait).toBe(0);
  });

  vtest('lenient keeps the old silent behaviour', async () => {
    const { page, calls } = fakePage({ nuxt: true, hydrates: false });
    await createGoto(page, 'http://127.0.0.1:9/', 'lenient')('/x', { waitUntil: 'load' });
    expect(calls.wait).toBe(1);
  });
});

describe('infra-only retry', () => {
  vtest('pattern matches infra errors, not assertions', () => {
    expect(INFRA_ERROR_PATTERN.test('page.goto: net::ERR_CONNECTION_REFUSED at http://x')).toBe(
      true,
    );
    expect(INFRA_ERROR_PATTERN.test('read ECONNRESET')).toBe(true);
    expect(
      INFRA_ERROR_PATTERN.test('locator.click: Target page, context or browser has been closed'),
    ).toBe(true);
    expect(INFRA_ERROR_PATTERN.test('expected "a" to be "b"')).toBe(false);
    expect(infraRetry(2)).toEqual({ count: 2, condition: INFRA_ERROR_PATTERN });
  });

  vtest('plugin retryInfra sets retry only when the user did not', async () => {
    const run = async (retry?: unknown) => {
      const config: any = { sequence: {}, globalSetup: [], setupFiles: [], retry };
      await untestutils({ retryInfra: 2, artifactsRoot: '/tmp/arts' }).configureVitest!({
        project: { name: 'd', config, provide: () => {} },
        vitest: { config: {}, projects: [] },
        injectTestProjects: async () => [],
      });
      return config.retry;
    };
    const keys = ['PREWARM', 'ARTIFACTS_DIR', 'BROWSERS', 'BROWSER'].map((k) => `UNTESTUTILS_${k}`);
    const saved = keys.map((k) => process.env[k]);
    try {
      expect(await run()).toEqual({ count: 2, condition: INFRA_ERROR_PATTERN });
      expect(await run(3)).toBe(3);
    } finally {
      keys.forEach((k, i) => {
        if (saved[i] === undefined) delete process.env[k];
        else process.env[k] = saved[i];
      });
    }
  });

  vtest('RetryReporter lists retried tests and writes JSON', async () => {
    const dir = await tmp('retry');
    const out = join(dir, 'retried.json');
    const lines: string[] = [];
    const reporter = new RetryReporter({ outputFile: out });
    reporter.onInit({ logger: { log: (m: unknown) => lines.push(String(m)) } });
    const tc = (name: string, retryCount: number, flaky: boolean) =>
      ({
        fullName: name,
        module: { moduleId: '/x.spec.ts' },
        diagnostic: () => ({ retryCount, flaky }),
        result: () => ({ errors: [{ message: 'read ECONNRESET\n  at …' }] }),
      }) as any;
    reporter.onTestCaseResult(tc('stable', 0, false));
    reporter.onTestCaseResult(tc('flaky one', 1, true));
    await reporter.onTestRunEnd();
    expect(lines.join('\n')).toMatch(
      /1 test\(s\) needed a retry[\s\S]*flaky one \(FLAKY, passed after 1 retry\)[\s\S]*read ECONNRESET/,
    );
    expect(JSON.parse(await readFile(out, 'utf8'))).toEqual([
      {
        name: 'flaky one',
        file: '/x.spec.ts',
        retryCount: 1,
        flaky: true,
        errors: ['read ECONNRESET'],
      },
    ]);
    await rm(dir, { recursive: true, force: true });
  });
});

// buildTimeout: test.override({ harness }) builds in a suite beforeAll, so a build slower
// than the test's own timeout no longer fails the test.
const buildRoot = join(tmpdir(), `untestutils-build-hook-${process.pid}`);
const prevArtifacts = process.env.UNTESTUTILS_ARTIFACTS_DIR;
process.env.UNTESTUTILS_ARTIFACTS_DIR = buildRoot;
let builds = 0;
const slowBuild = defineRecipe({
  id: 'slow-build-hook',
  share: 'prepare-only',
  prepare: async () => {
    builds++;
    await sleep(400);
  },
  start: async () => ({}) as never,
});

// Cold build: the build (here a stand-in for Nuxt's in-process build) runs its own
// AsyncLocalStorage. After that the store `useHarness` set with enterWith did not reach the
// baseURL fixture → "[untestutils] no harness url". The fixture now uses the returned handle.
const alsBuild = defineRecipe({
  id: 'als-build-hook',
  share: 'always',
  prepare: async () => {
    await new AsyncLocalStorage<object>().run({}, () => sleep(20));
  },
  start: async ({ port }) => ({ kind: 'url', url: `http://127.0.0.1:${port}/` }),
  ready: async () => {},
});

describe('cold build: baseURL from the harness handle', () => {
  harnessTest.override({ harness: alsBuild });

  harnessTest('baseURL is the started target after a cold build', ({ baseURL }) => {
    expect(baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  });
});

describe('buildTimeout (override → beforeAll)', () => {
  harnessTest.override({ harness: slowBuild });

  harnessTest('build ran in the hook, not in this 100ms test', { timeout: 100 }, () => {
    expect(builds).toBe(1);
  });

  vtest('override arg parsing and env', () => {
    expect(overrideHarnessValue([{ harness: 'site' }])).toBe('site');
    expect(overrideHarnessValue(['harness', 'site'])).toBe('site');
    expect(overrideHarnessValue(['harness', {}, 'site'])).toBe('site');
    expect(overrideHarnessValue([{ page: 1 }])).toBeUndefined();
    const prev = process.env.UNTESTUTILS_BUILD_TIMEOUT;
    try {
      delete process.env.UNTESTUTILS_BUILD_TIMEOUT;
      expect(resolveBuildTimeout()).toBeUndefined();
      process.env.UNTESTUTILS_BUILD_TIMEOUT = '0';
      expect(resolveBuildTimeout()).toBe(false);
      process.env.UNTESTUTILS_BUILD_TIMEOUT = '600000';
      expect(resolveBuildTimeout()).toBe(600_000);
    } finally {
      if (prev === undefined) delete process.env.UNTESTUTILS_BUILD_TIMEOUT;
      else process.env.UNTESTUTILS_BUILD_TIMEOUT = prev;
    }
  });

  afterAll(async () => {
    if (prevArtifacts === undefined) delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    else process.env.UNTESTUTILS_ARTIFACTS_DIR = prevArtifacts;
    await rm(buildRoot, { recursive: true, force: true });
  });
});

describe('review follow-ups', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  vtest('released lock is never recreated by an in-flight heartbeat', async () => {
    dir = await tmp('lockbeat');
    const path = join(dir, 'b.lock');
    const lock = new FileLock(path, 'b');
    await lock.acquire(1000);
    const beat = (lock as unknown as { beat: () => Promise<void> }).beat();
    await lock.release();
    await beat;
    await (lock as unknown as { beat: () => Promise<void> }).beat();
    expect(existsSync(path)).toBe(false);
  });

  vtest('release does not delete a lock that a takeover replaced', async () => {
    dir = await tmp('locktake');
    const path = join(dir, 't.lock');
    const a = new FileLock(path, 't');
    await a.acquire(1000);
    await unlink(path); // simulate a stale takeover…
    const b = new FileLock(path, 't');
    expect(await b.tryAcquire()).toBe(true); // …by a new holder
    await a.release();
    expect(existsSync(path)).toBe(true);
    await b.release();
    expect(existsSync(path)).toBe(false);
  });

  vtest('GC groups by recorded recipe id and honours the share:never id lock', async () => {
    dir = await tmp('gcid');
    const store = new ArtifactStore(dir);
    const now = Date.now();
    for (const [identity, at] of [
      ['my-app-aaaaaaaaaaaa', now - 3000],
      ['my-app-bbbbbbbbbbbb', now - 2000],
      ['my-app-cccccccccccc', now - 1000],
    ] as const) {
      await store.ensureDir(identity);
      // "my app" and "my-app" sanitize alike — meta keeps them apart.
      await store.commit(identity, 'h', identity === 'my-app-cccccccccccc' ? 'my-app' : 'my app');
      await writeFile(store.lastUsedFile(identity), String(at));
    }
    const idLock = new FileLock(lockPathFor(dir, 'my app'), 'my app');
    await idLock.acquire(1000);
    try {
      const res = await pruneBuilds(dir, { keep: 1 });
      // "my app": keep b (newest), a would go but its id lock is held → kept.
      expect(res.removed).toEqual([]);
    } finally {
      await idLock.release();
    }
    const res = await pruneBuilds(dir, { keep: 1 });
    expect(res.removed).toEqual(['my-app-aaaaaaaaaaaa']);
  });

  vtest('infra pattern ignores assertion text that only mentions a token', () => {
    expect(INFRA_ERROR_PATTERN.test('expected "ECONNREFUSED" to be "ok"')).toBe(false);
    expect(INFRA_ERROR_PATTERN.test('connect ECONNREFUSED 127.0.0.1:3000')).toBe(true);
    expect(INFRA_ERROR_PATTERN.test('page.goto: net::ERR_CONNECTION_RESET at http://x/')).toBe(
      true,
    );
  });

  vtest('gc.keep < 1 is rejected; Vitest < 4.1 skips retryInfra', async () => {
    expect(supportsRetryCondition('4.0.18')).toBe(false);
    expect(supportsRetryCondition('4.1.0')).toBe(true);
    expect(supportsRetryCondition('5.0.1')).toBe(true);
    const config: any = { sequence: {}, globalSetup: [], setupFiles: [] };
    const keys = ['PREWARM', 'ARTIFACTS_DIR', 'BROWSERS', 'BROWSER', 'GC'].map(
      (k) => `UNTESTUTILS_${k}`,
    );
    const saved = keys.map((k) => process.env[k]);
    try {
      await expect(
        untestutils({ gc: { keep: 0 }, artifactsRoot: '/tmp/arts' }).configureVitest!({
          project: { name: 'd', config, provide: () => {} },
          vitest: { config: {}, projects: [] },
          injectTestProjects: async () => [],
        }),
      ).rejects.toThrow(/gc.keep must be an integer >= 1/);
    } finally {
      keys.forEach((k, i) => {
        if (saved[i] === undefined) delete process.env[k];
        else process.env[k] = saved[i];
      });
    }
  });

  vtest('RetryReporter drains between runs (watch mode)', async () => {
    const lines: string[] = [];
    const reporter = new RetryReporter();
    reporter.onInit({ logger: { log: (m: unknown) => lines.push(String(m)) } });
    reporter.onTestCaseResult({
      fullName: 'once',
      module: { moduleId: '/x.spec.ts' },
      diagnostic: () => ({ retryCount: 1, flaky: true }),
      result: () => ({ errors: [] }),
    } as any);
    await reporter.onTestRunEnd();
    lines.length = 0;
    await reporter.onTestRunEnd();
    expect(lines).toEqual([]);
  });
});

describe('lock keys', () => {
  vtest('unsafe recipe ids never escape run/locks', () => {
    const root = '/tmp/arts';
    const locks = join(root, 'run', 'locks');
    for (const id of ['..', '../../etc/passwd', 'a/b', 'my app', '.hidden']) {
      const p = lockPathFor(root, id);
      expect(p.startsWith(`${locks}/`)).toBe(true);
      expect(p.slice(locks.length + 1)).not.toContain('/');
    }
    expect(lockPathFor(root, 'site-abcdef012345')).toBe(join(locks, 'site-abcdef012345.lock'));
    expect(lockPathFor(root, 'a/b')).not.toBe(lockPathFor(root, 'a_b'));
  });
});

describe('lock init failure', () => {
  vtest('failed init removes only its own lock file', async () => {
    const dir = await tmp('lockinit');
    const path = join(dir, 'i.lock');
    const lock = new FileLock(path, 'i');
    // First write after open(wx) fails — simulate a full disk (FileHandle is a class).
    const probe = await open(join(dir, 'probe'), 'w');
    const proto = Object.getPrototypeOf(probe) as { writeFile: () => Promise<void> };
    await probe.close();
    const spy = vi.spyOn(proto, 'writeFile').mockRejectedValueOnce(new Error('ENOSPC'));
    try {
      await expect(lock.tryAcquire()).rejects.toThrow('ENOSPC');
      expect(existsSync(path)).toBe(false);
    } finally {
      spy.mockRestore();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(process.platform === 'win32')('concurrent runs in one checkout', () => {
  let root: string;
  const prevRun = process.env.UNTESTUTILS_RUN_ID;
  const asRun = (id: string | undefined) => {
    if (id === undefined) delete process.env.UNTESTUTILS_RUN_ID;
    else process.env.UNTESTUTILS_RUN_ID = id;
  };
  afterEach(async () => {
    asRun(prevRun);
    await rm(root, { recursive: true, force: true });
  });

  const sleeper = () =>
    spawnManaged(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { captureLogs: true });
  const register = (id: string, pid: number | undefined) =>
    new TargetRegistry(root).set({ id, identity: id, pid, pidStart: processStartToken(pid) });

  vtest("a run's setup/teardown never stops another live run's servers", async () => {
    root = await tmp('runs');
    const serverA = sleeper();
    const serverB = sleeper();
    try {
      await sleep(100);
      asRun('run-a');
      await beginRun(root);
      await register('site', serverA.pid);

      asRun('run-b'); // second `vitest run` starts while A is mid-run
      await beginRun(root);
      expect(serverA.alive()).toBe(true);
      await register('site', serverB.pid); // same recipe id, own server
      expect(serverA.alive()).toBe(true);
      await endRun(root);
      expect(serverB.alive()).toBe(false);
      expect(serverA.alive()).toBe(true);
      expect(existsSync(join(root, 'run', 'runs', 'run-b'))).toBe(false);

      asRun('run-a');
      await endRun(root);
      expect(serverA.alive()).toBe(false);
    } finally {
      await serverA.stop();
      await serverB.stop();
    }
  });

  vtest('setup reclaims servers of a run whose owner died, and the shared registry', async () => {
    root = await tmp('orphans');
    const orphan = sleeper();
    const legacy = sleeper();
    const dead = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], {
      encoding: 'utf8',
    });
    try {
      await sleep(100);
      const crashed = join(root, 'run', 'runs', 'crashed');
      await mkdir(crashed, { recursive: true });
      await writeFile(join(crashed, 'owner.json'), JSON.stringify({ pid: Number(dead.stdout) }));
      asRun('crashed');
      await register('site', orphan.pid);
      asRun(undefined); // pre-run-id registry (`run/targets.json`)
      await register('old', legacy.pid);

      asRun('fresh');
      await beginRun(root);
      expect(orphan.alive()).toBe(false);
      expect(legacy.alive()).toBe(false);
      expect(existsSync(crashed)).toBe(false);
      await endRun(root);
    } finally {
      await orphan.stop();
      await legacy.stop();
    }
  });

  vtest('a nested runner gets its own run id; dot-only ids stay inside runs/', async () => {
    const prevOwner = process.env.UNTESTUTILS_RUN_OWNER;
    try {
      // Inherited from a parent runner (another pid) → fresh id, not shared.
      process.env.UNTESTUTILS_RUN_ID = 'parent-run';
      process.env.UNTESTUTILS_RUN_OWNER = '1';
      const id = ensureRunId();
      expect(id).not.toBe('parent-run');
      expect(ensureRunId()).toBe(id); // stable within the runner
    } finally {
      if (prevOwner === undefined) delete process.env.UNTESTUTILS_RUN_OWNER;
      else process.env.UNTESTUTILS_RUN_OWNER = prevOwner;
    }
    root = await tmp('runid');
    expect(runDir(root, '..')).toBe(join(root, 'run', 'runs', '_'));
    expect(runDir(root, '.')).toBe(join(root, 'run', 'runs', '_'));
    expect(runDir(root, 'a/../b')).toBe(join(root, 'run', 'runs', 'a_.._b'));
  });

  vtest('a legacy targets.json pid is stopped once, not twice', async () => {
    root = await tmp('legacy-dedupe');
    const legacy = sleeper();
    try {
      await sleep(100);
      // No run/targets.json yet → the shared drain falls back to this file, then the legacy
      // drain reads it again.
      await writeFile(
        join(root, 'targets.json'),
        JSON.stringify({ old: { id: 'old', identity: 'old', pid: legacy.pid } }),
      );
      const kill = vi.spyOn(process, 'kill');
      asRun('dedupe');
      await beginRun(root);
      const sigterms = kill.mock.calls.filter(
        ([p, sig]) => p === -legacy.pid! && sig === 'SIGTERM',
      );
      kill.mockRestore();
      expect(sigterms).toHaveLength(1);
      expect(legacy.alive()).toBe(false);
      await endRun(root);
    } finally {
      await legacy.stop();
    }
  });

  vtest('stopAllTargets keeps the event loop alive until servers are gone', () => {
    // An unref'd wait let Node exit 0 mid-await: globalSetup "passed" having run 0 tests.
    const script = `
      import { spawn } from 'node:child_process';
      import { mkdtempSync } from 'node:fs';
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      import { TargetRegistry, stopAllTargets } from ${JSON.stringify(join(import.meta.dirname, '../../packages/core/src/index.ts'))};
      const root = mkdtempSync(join(tmpdir(), 'untestutils-loop-'));
      const server = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setTimeout(() => {}, 30000)'], { detached: true, stdio: 'ignore' });
      server.unref();
      await new Promise((r) => setTimeout(r, 200));
      await new TargetRegistry(root).set({ id: 's', identity: 's', pid: server.pid });
      await stopAllTargets(root, { graceMs: 300 });
      console.log('stopped');
    `;
    const tsx = join(import.meta.dirname, '../../node_modules/.bin/tsx');
    const res = spawnSync(tsx, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    expect(res.stdout).toContain('stopped');
    expect(res.status).toBe(0);
  });

  vtest('globalSetup fails the run when its event loop drains mid-setup', async () => {
    root = await tmp('aborted');
    const hang = join(root, 'recipes.mjs');
    // Only an unref'd timer pending → the loop drains while setup awaits it.
    await writeFile(hang, 'await new Promise((r) => setTimeout(r, 60000).unref());\n');
    const setup = join(import.meta.dirname, '../../packages/vitest/src/global-setup.ts');
    const tsx = join(import.meta.dirname, '../../node_modules/.bin/tsx');
    const res = spawnSync(
      tsx,
      ['--input-type=module', '-e', `await (await import(${JSON.stringify(setup)})).default({});`],
      {
        encoding: 'utf8',
        env: { ...process.env, UNTESTUTILS_RECIPES_MODULE: hang, UNTESTUTILS_ARTIFACTS_DIR: root },
      },
    );
    expect(res.stderr).toContain('global setup aborted before tests ran');
    expect(res.status).toBe(1);
  });

  vtest('playwright global setup fails the run the same way', async () => {
    root = await tmp('aborted-pw');
    const hang = join(root, 'recipes.mjs');
    await writeFile(hang, 'await new Promise((r) => setTimeout(r, 60000).unref());\n');
    const pw = join(import.meta.dirname, '../../packages/playwright/src/index.ts');
    const tsx = join(import.meta.dirname, '../../node_modules/.bin/tsx');
    const res = spawnSync(
      tsx,
      [
        '--input-type=module',
        '-e',
        `await (await import(${JSON.stringify(pw)})).playwrightGlobalSetup();`,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, UNTESTUTILS_RECIPES_MODULE: hang, UNTESTUTILS_ARTIFACTS_DIR: root },
      },
    );
    expect(res.stderr).toContain('global setup aborted before tests ran');
    expect(res.status).toBe(1);
  });
});
