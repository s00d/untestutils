import { spawn } from 'node:child_process';
import net from 'node:net';
import { getFreePort, LOOPBACK_HOST, waitForHttpReady } from '@untestutils/core';
import { resolve } from 'pathe';
import { finalizeSamples, startProcessMonitor, type SampleAccumulator } from './process-sample';
import type { PerfTarget, ProcessMetrics } from './types';

export type StartedTarget = {
  url: string;
  port: number;
  pid?: number;
  stop: () => Promise<void>;
  takeProcessMetrics: () => ProcessMetrics;
};

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

export async function startTarget(target: PerfTarget): Promise<StartedTarget> {
  const cwd = resolve(target.start.cwd ?? target.root);
  const host = target.start.host ?? LOOPBACK_HOST;
  let port = target.start.port;

  // Fixed ports (e.g. fixture LOAD_PORT=10000) collide with other local services —
  // never treat an already-bound listener as "our" server ready.
  if (!(await isPortFree(port, host))) {
    const next = await getFreePort(host);
    console.warn(`[untestutils/perf] ${host}:${port} busy — using ${next}`);
    port = next;
  }

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

  child.stdout?.on('data', (b: Buffer) => {
    const t = b.toString().trim();
    if (t) console.log(`  [server] ${t.slice(0, 200)}`);
  });
  child.stderr?.on('data', (b: Buffer) => {
    const t = b.toString().trim();
    if (t) console.error(`  [server stderr] ${t.slice(0, 200)}`);
  });

  let monitorAcc: SampleAccumulator | undefined;
  let stopMonitor: (() => void) | undefined;

  const empty: ProcessMetrics = {
    maxMemoryMb: 0,
    minMemoryMb: 0,
    avgMemoryMb: 0,
    maxCpuPct: 0,
    minCpuPct: 0,
    avgCpuPct: 0,
  };

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

  // Sample only while serving (ready → stop). Starting earlier often yields 0 samples
  // when ready is fast (< monitor interval), which zeroed load CPU/RSS in reports.
  if (child.pid) {
    const m = startProcessMonitor(child.pid);
    monitorAcc = m.acc;
    stopMonitor = m.stop;
  }

  return {
    url,
    port,
    pid: child.pid,
    takeProcessMetrics: () => (monitorAcc ? finalizeSamples(monitorAcc) : empty),
    stop: async () => {
      stopMonitor?.();
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
