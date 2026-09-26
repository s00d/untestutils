import { type ChildProcess, spawn } from 'node:child_process';
import { platform } from 'node:os';
import { debug } from './debug';

const STRIP_ENV = [
  'VITEST',
  'VITEST_WORKER_ID',
  'VITEST_POOL_ID',
  'TEST',
  'JEST_WORKER_ID',
  'JEST',
];

export function scrubTestEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...env };
  for (const key of STRIP_ENV) delete next[key];
  return next;
}

export interface SpawnOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  captureLogs?: boolean;
  /**
   * When true (default on unix for servers), spawn as process-group leader so
   * `stop()` tears down children. Foreground tools use `runCommand` instead.
   */
  server?: boolean;
}

export type StopOpts = {
  /** Grace before SIGKILL / taskkill escalate. Default 2000. */
  graceMs?: number;
  /** Initial signal on unix. Default SIGTERM. */
  signal?: NodeJS.Signals;
  /**
   * When true, keep the Node event loop alive while waiting for death.
   * Default false — poll timers are `.unref()`.
   */
  keepEventLoop?: boolean;
};

/**
 * Handle for a spawned (or adopted) process.
 * Users call `stop()` / `alive()` / `logs()` — never raw PIDs or kill APIs.
 */
export interface ManagedProcess {
  stop: (opts?: StopOpts) => Promise<void>;
  alive: () => boolean;
  logs: () => string;
  /**
   * OS pid for registry persistence / metrics only.
   * Do not use for teardown — call `stop()`.
   */
  readonly pid?: number;
}

/** @internal mutable seams — tests replace these */
export const processPlatform = {
  current: (): NodeJS.Platform => platform(),
};

export const processIo = {
  spawn: ((...args: Parameters<typeof spawn>) => spawn(...args)) as typeof spawn,
  kill: ((pid: number, signal?: NodeJS.Signals | number) =>
    process.kill(pid, signal)) as typeof process.kill,
};

function envFlagCapture(): boolean {
  return process.env.UNTESTUTILS_CAPTURE_LOGS === '1';
}

function probeAlive(pid: number): boolean {
  if (!pid || pid <= 1) return false;
  try {
    processIo.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function shouldSkipPid(pid: number | undefined | null): pid is null | undefined | 0 {
  return !pid || pid <= 1 || pid === process.pid;
}

function waitUntilDead(pid: number, graceMs: number, keepEventLoop = false): Promise<void> {
  return new Promise((resolve) => {
    if (!probeAlive(pid)) {
      resolve();
      return;
    }
    const started = Date.now();
    const poll = setInterval(() => {
      if (!probeAlive(pid) || Date.now() - started >= graceMs) {
        clearInterval(poll);
        resolve();
      }
    }, 50);
    if (!keepEventLoop) poll.unref();
  });
}

async function stopSinglePid(pid: number, opts: StopOpts = {}): Promise<void> {
  if (shouldSkipPid(pid)) return;
  if (!probeAlive(pid)) return;

  const graceMs = opts.graceMs ?? 2000;
  const signal = opts.signal ?? 'SIGTERM';

  if (processPlatform.current() === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = processIo.spawn('taskkill', ['/F', '/PID', String(pid)], {
        stdio: 'ignore',
      });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
      const settle = setTimeout(resolve, Math.max(graceMs, 5000));
      if (!opts.keepEventLoop) settle.unref();
    });
    return;
  }

  try {
    processIo.kill(pid, signal);
  } catch {
    /* already gone */
  }
  if (!probeAlive(pid)) return;

  await waitUntilDead(pid, graceMs, opts.keepEventLoop);
  if (!probeAlive(pid)) return;

  try {
    processIo.kill(pid, 'SIGKILL');
  } catch {
    /* */
  }
  await waitUntilDead(pid, 500, opts.keepEventLoop);
}

/** Stop a unix process group / Win process tree whose leader is `pid`. */
async function stopServerPid(pid: number, opts: StopOpts = {}): Promise<void> {
  if (shouldSkipPid(pid)) return;
  if (!probeAlive(pid)) return;

  const graceMs = opts.graceMs ?? 2000;
  const signal = opts.signal ?? 'SIGTERM';

  if (processPlatform.current() === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = processIo.spawn('taskkill', ['/T', '/F', '/PID', String(pid)], {
        stdio: 'ignore',
      });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
      const settle = setTimeout(resolve, Math.max(graceMs, 5000));
      if (!opts.keepEventLoop) settle.unref();
    });
    return;
  }

  let groupOk = false;
  try {
    processIo.kill(-pid, signal);
    groupOk = true;
  } catch {
    /* not a group leader — fall back to single */
  }

  if (!groupOk) {
    await stopSinglePid(pid, opts);
    return;
  }

  if (!probeAlive(pid)) return;

  await waitUntilDead(pid, graceMs, opts.keepEventLoop);
  if (!probeAlive(pid)) return;

  try {
    processIo.kill(-pid, 'SIGKILL');
  } catch {
    try {
      processIo.kill(pid, 'SIGKILL');
    } catch {
      /* */
    }
  }
  await waitUntilDead(pid, 500, opts.keepEventLoop);
}

async function stopChildProcess(
  child: ChildProcess,
  kind: 'server' | 'process',
  opts: StopOpts = {},
): Promise<void> {
  const pid = child.pid;
  if (shouldSkipPid(pid)) return;

  if (processPlatform.current() === 'win32' || kind === 'server') {
    await stopServerPid(pid!, opts);
    return;
  }

  const graceMs = opts.graceMs ?? 2000;
  const signal = opts.signal ?? 'SIGTERM';
  try {
    child.kill(signal);
  } catch {
    /* */
  }
  if (!probeAlive(pid!)) return;
  await waitUntilDead(pid!, graceMs, opts.keepEventLoop);
  if (!probeAlive(pid!)) return;
  try {
    child.kill('SIGKILL');
  } catch {
    try {
      processIo.kill(pid!, 'SIGKILL');
    } catch {
      /* */
    }
  }
  await waitUntilDead(pid!, 500, opts.keepEventLoop);
}

function createHandle(opts: {
  pid?: number;
  kind: 'server' | 'process';
  child?: ChildProcess;
  logs?: () => string;
}): ManagedProcess {
  const kind = opts.kind;
  let stopInflight: Promise<void> | undefined;
  return {
    get pid() {
      return opts.pid ?? opts.child?.pid;
    },
    alive: () => {
      const pid = opts.pid ?? opts.child?.pid;
      return typeof pid === 'number' ? probeAlive(pid) : false;
    },
    logs: opts.logs ?? (() => ''),
    stop: (stopOpts = {}) => {
      if (stopInflight) return stopInflight;
      stopInflight = (async () => {
        try {
          if (opts.child) {
            await stopChildProcess(opts.child, kind, stopOpts);
            return;
          }
          if (typeof opts.pid === 'number') {
            if (kind === 'server') await stopServerPid(opts.pid, stopOpts);
            else await stopSinglePid(opts.pid, stopOpts);
          }
        } finally {
          const pid = opts.pid ?? opts.child?.pid;
          // Allow a later stop() if the process is still alive after a soft failure.
          if (typeof pid === 'number' && probeAlive(pid)) stopInflight = undefined;
        }
      })();
      return stopInflight;
    },
  };
}

/**
 * Adopt a pid from the target registry (orphan reclaim after a crash).
 * Recipe servers are always `'server'` (process group / taskkill tree).
 */
export function adoptProcess(pid: number, kind: 'server' | 'process' = 'server'): ManagedProcess {
  return createHandle({ pid, kind });
}

/**
 * Spawn a long-lived managed process (dev servers, recipe starts).
 * Call `handle.stop()` — do not dig for PIDs.
 */
export function spawnManaged(
  command: string,
  args: string[],
  opts: SpawnOpts = {},
): ManagedProcess {
  const env = scrubTestEnv(opts.env ?? process.env);
  const capture = opts.captureLogs ?? envFlagCapture();
  let output = '';
  const asServer = opts.server ?? processPlatform.current() !== 'win32';
  const detached = asServer && processPlatform.current() !== 'win32';

  debug('spawn', `${command} ${args.join(' ')}`, { cwd: opts.cwd });

  const child = processIo.spawn(command, args, {
    cwd: opts.cwd,
    env,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    detached,
  });

  if (capture) {
    child.stdout?.on('data', (c: Buffer) => {
      output += c.toString();
    });
    child.stderr?.on('data', (c: Buffer) => {
      output += c.toString();
    });
  }

  return createHandle({
    child,
    pid: child.pid,
    kind: asServer ? 'server' : 'process',
    logs: () => output,
  });
}

export async function runCommand(
  command: string,
  args: string[],
  opts: SpawnOpts & { timeoutMs?: number } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const env = scrubTestEnv(opts.env ?? process.env);
  return new Promise((resolve, reject) => {
    const child = processIo.spawn(command, args, {
      cwd: opts.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const handle = createHandle({ child, pid: child.pid, kind: 'process' });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString();
      if (process.env.UNTESTUTILS_DEBUG === '1') process.stderr.write(c);
    });
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
      if (process.env.UNTESTUTILS_DEBUG === '1') process.stderr.write(c);
    });
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          void handle.stop();
          reject(new Error(`[untestutils] command timed out: ${command} ${args.join(' ')}`));
        }, opts.timeoutMs)
      : undefined;
    child.on('error', (err: Error) => {
      reject(new Error(`[untestutils] failed to spawn ${command}: ${err.message}`, { cause: err }));
    });
    child.on('exit', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}
