import { spawn } from 'node:child_process';
import net from 'node:net';
import { getFreePort, LOOPBACK_HOST, waitForHttpReady } from '@untestutils/core';
import { resolve } from 'pathe';
import { ProcessSampler } from './process-sample';
import type { PerfTarget, ProcessMetrics } from './types';
import type { HarnessOpts } from './ui';

export type StartedTarget = {
  url: string;
  port: number;
  /** Port originally requested (before free-port fallback). */
  requestedPort: number;
  pid?: number;
  /** Push a process checkpoint (call at load phase boundaries). */
  noteProcess: () => void;
  takeProcessMetrics: () => ProcessMetrics;
  stop: () => Promise<void>;
};

export type StartTargetOpts = HarnessOpts & {
  /** Override `target.start.port` (suite port allocator). */
  preferredPort?: number;
};

const emptyMetrics = (): ProcessMetrics => ({
  maxMemoryMb: 0,
  minMemoryMb: 0,
  avgMemoryMb: 0,
  maxCpuPct: 0,
  minCpuPct: 0,
  avgCpuPct: 0,
});

/** True when nothing is listening / bound on host:port. */
export function isPortFree(port: number, host: string = LOOPBACK_HOST): Promise<boolean> {
  return new Promise((resolvePromise: (value: boolean) => void) => {
    const server = net.createServer();
    server.once('error', () => resolvePromise(false));
    server.listen(port, host, () => {
      server.close(() => resolvePromise(true));
    });
  });
}

export async function startTarget(
  target: PerfTarget,
  opts: StartTargetOpts = {},
): Promise<StartedTarget> {
  const cwd = resolve(target.start.cwd ?? target.root);
  const host = target.start.host ?? LOOPBACK_HOST;
  const requestedPort = opts.preferredPort ?? target.start.port;
  let port = requestedPort;

  // Fixed ports (e.g. fixture LOAD_PORT=10000) collide with other local services —
  // never treat an already-bound listener as "our" server ready.
  if (!(await isPortFree(port, host))) {
    port = await getFreePort(host);
  }

  const detail = port === requestedPort ? `:${port}` : `:${port}  (${requestedPort} in use)`;
  opts.ui?.emit({ type: 'phase', phase: 'start', detail });

  const url = `http://${host}:${port}`;

  const child = spawn(target.start.command, target.start.args ?? [], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: host,
      NODE_ENV: 'production',
      ...target.start.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  const verbose = opts.ui?.verbosity === 'verbose';
  child.stdout?.on('data', (b: Buffer) => {
    for (const line of b.toString().split('\n')) {
      const t = line.trim();
      if (t && verbose) opts.ui?.emit({ type: 'log', channel: 'server', line: t.slice(0, 200) });
    }
  });
  child.stderr?.on('data', (b: Buffer) => {
    for (const line of b.toString().split('\n')) {
      const t = line.trim();
      if (t && (verbose || /ERROR|WARN/i.test(t))) {
        opts.ui?.emit({ type: 'log', channel: 'server', line: t.slice(0, 200) });
      }
    }
  });

  try {
    await new Promise<void>((resolveReady, reject) => {
      const onExit = (code: number | null) => {
        reject(new Error(`[untestutils/perf] server exited before ready (code=${code})`));
      };
      child.once('exit', onExit);
      waitForHttpReady(url, {
        path: target.start.readyPath ?? '/',
        timeoutMs: target.start.readyTimeoutMs ?? 60_000,
      })
        .then(() => {
          child.off('exit', onExit);
          resolveReady();
        })
        .catch((err: unknown) => {
          child.off('exit', onExit);
          reject(err);
        });
    });
  } catch (err) {
    await killChild(child);
    throw err;
  }

  const sampler = child.pid ? new ProcessSampler(child.pid) : undefined;
  sampler?.begin();

  return {
    url,
    port,
    requestedPort,
    pid: child.pid,
    noteProcess: () => sampler?.note(),
    takeProcessMetrics: () => (sampler ? sampler.finalize() : emptyMetrics()),
    stop: async () => {
      await killChild(child);
    },
  };
}

async function killChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (!child.pid) return;
  try {
    if (process.platform !== 'win32') {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        process.kill(child.pid, 'SIGTERM');
      }
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 300));
}
