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
}

export interface ManagedProcess {
  child: ChildProcess;
  pid?: number;
  stop: () => Promise<void>;
  logs: () => string;
}

/** @internal mutable seams — tests replace these; never call real kill/spawn from unit tests */
export const processPlatform = {
  current: (): NodeJS.Platform => platform(),
};

export const processIo = {
  spawn: ((...args: Parameters<typeof spawn>) => spawn(...args)) as typeof spawn,
  kill: ((pid: number, signal?: NodeJS.Signals | number) =>
    process.kill(pid, signal)) as typeof process.kill,
};

export function currentPlatform(): NodeJS.Platform {
  return processPlatform.current();
}

export function spawnManaged(
  command: string,
  args: string[],
  opts: SpawnOpts = {},
): ManagedProcess {
  const env = scrubTestEnv(opts.env ?? process.env);
  const capture = opts.captureLogs ?? envFlagCapture();
  let output = '';

  debug('spawn', `${command} ${args.join(' ')}`, { cwd: opts.cwd });

  const child = processIo.spawn(command, args, {
    cwd: opts.cwd,
    env,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    detached: currentPlatform() !== 'win32',
  });

  if (capture) {
    child.stdout?.on('data', (c: Buffer) => {
      output += c.toString();
    });
    child.stderr?.on('data', (c: Buffer) => {
      output += c.toString();
    });
  }

  const stop = async () => {
    /* v8 ignore next */
    if (!child.pid) return;
    await killProcessTree(child);
  };

  return {
    child,
    pid: child.pid,
    stop,
    logs: () => output,
  };
}

function envFlagCapture(): boolean {
  return process.env.UNTESTUTILS_CAPTURE_LOGS === '1';
}

/** True when `pid` refers to a live process (signal 0). */
export function isPidAlive(pid: number): boolean {
  if (!pid || pid <= 1) return false;
  try {
    processIo.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Kill a process group by pid (detached spawn) without needing the ChildProcess handle. */
export async function killPidTree(pid: number): Promise<void> {
  // Guard: never touch init/launchd or the current test process.
  if (!pid || pid <= 1 || pid === process.pid) return;

  if (currentPlatform() === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = processIo.spawn('taskkill', ['/T', '/F', '/PID', String(pid)], {
        stdio: 'ignore',
      });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
      setTimeout(resolve, 5000).unref();
    });
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      processIo.kill(-pid, 'SIGTERM');
    } catch {
      try {
        processIo.kill(pid, 'SIGTERM');
      } catch {
        /* */
      }
    }
    const t = setTimeout(() => {
      try {
        processIo.kill(-pid, 'SIGKILL');
      } catch {
        try {
          processIo.kill(pid, 'SIGKILL');
        } catch {
          /* */
        }
      }
      resolve();
    }, 2000);
    t.unref();
    const poll = setInterval(() => {
      if (!isPidAlive(pid)) {
        clearInterval(poll);
        clearTimeout(t);
        resolve();
      }
    }, 50);
    poll.unref();
  });
}

export async function killProcessTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid || pid <= 1 || pid === process.pid) return;

  if (currentPlatform() === 'win32') {
    await killPidTree(pid);
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      processIo.kill(-pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        /* */
      }
    }
    const t = setTimeout(() => {
      try {
        processIo.kill(-pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          /* */
        }
      }
      resolve();
    }, 5000);
    t.unref();
    child.once('exit', () => {
      clearTimeout(t);
      resolve();
    });
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
          void killProcessTree(child);
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
