import { spawn } from 'node:child_process';
import { waitForHttpReady } from '@untestutils/core';
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

export async function startTarget(target: PerfTarget): Promise<StartedTarget> {
  const cwd = resolve(target.start.cwd ?? target.root);
  const port = target.start.port;
  const host = target.start.host ?? '127.0.0.1';
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
  if (child.pid) {
    const m = startProcessMonitor(child.pid);
    monitorAcc = m.acc;
    stopMonitor = m.stop;
  }

  const empty: ProcessMetrics = {
    maxMemoryMb: 0,
    minMemoryMb: 0,
    avgMemoryMb: 0,
    maxCpuPct: 0,
    minCpuPct: 0,
    avgCpuPct: 0,
  };

  try {
    await waitForHttpReady(url, {
      path: target.start.readyPath ?? '/',
      timeoutMs: target.start.readyTimeoutMs ?? 60_000,
    });
  } catch (err) {
    stopMonitor?.();
    await killChild(child);
    throw err;
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
