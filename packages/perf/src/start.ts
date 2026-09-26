import net from 'node:net';
import { getFreePort, LOOPBACK_HOST, waitForHttpReady, spawnManaged } from '@untestutils/core';
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

  const managed = spawnManaged(target.start.command, target.start.args ?? [], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: host,
      NODE_ENV: 'production',
      ...target.start.env,
    },
    captureLogs: true,
    server: true,
  });

  const verbose = opts.ui?.verbosity === 'verbose';
  let logCursor = 0;
  const pumpLogs = setInterval(() => {
    const all = managed.logs();
    if (all.length <= logCursor) return;
    const chunk = all.slice(logCursor);
    logCursor = all.length;
    for (const line of chunk.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (verbose) opts.ui?.emit({ type: 'log', channel: 'server', line: t.slice(0, 200) });
      else if (/ERROR|WARN/i.test(t)) {
        opts.ui?.emit({ type: 'log', channel: 'server', line: t.slice(0, 200) });
      }
    }
  }, 200);
  pumpLogs.unref?.();

  const readyTimeoutMs = target.start.readyTimeoutMs ?? 60_000;
  const readyPath = target.start.readyPath ?? '/';
  try {
    await Promise.race([
      waitForHttpReady(url, { path: readyPath, timeoutMs: readyTimeoutMs }),
      new Promise<never>((_, reject) => {
        const started = Date.now();
        const poll = setInterval(() => {
          if (!managed.alive()) {
            clearInterval(poll);
            reject(new Error('[untestutils/perf] server exited before ready'));
          } else if (Date.now() - started >= readyTimeoutMs) {
            clearInterval(poll);
          }
        }, 100);
        poll.unref?.();
      }),
    ]);
  } catch (err) {
    clearInterval(pumpLogs);
    await managed.stop();
    throw err;
  }

  if (!managed.alive()) {
    clearInterval(pumpLogs);
    await managed.stop();
    throw new Error('[untestutils/perf] server exited before ready');
  }

  const sampler = managed.pid ? new ProcessSampler(managed.pid) : undefined;
  sampler?.begin();

  return {
    url,
    port,
    requestedPort,
    pid: managed.pid,
    noteProcess: () => sampler?.note(),
    takeProcessMetrics: () => (sampler ? sampler.finalize() : emptyMetrics()),
    stop: async () => {
      clearInterval(pumpLogs);
      await managed.stop();
    },
  };
}
