import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { resolve } from 'pathe';
import { measureBundle } from './bundle';
import { finalizeSamples, startProcessMonitor } from './process-sample';
import type { BuildMetrics, PerfTarget } from './types';

const defaultLogFilter = (line: string) =>
  /Building|built|ERROR|WARN|preset|complete|Nitro|Client|Server|✓|✔/i.test(line);

export async function measureBuild(target: PerfTarget): Promise<BuildMetrics> {
  const cwd = resolve(target.build.cwd ?? target.root);
  const args = target.build.args ?? [];
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    USER: process.env.USER,
    SHELL: process.env.SHELL,
    NODE_ENV: 'production',
    ...target.build.env,
  };

  const started = performance.now();
  const child = spawn(target.build.command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const filter = target.build.logFilter ?? defaultLogFilter;
  child.stdout?.on('data', (buf: Buffer) => {
    for (const line of buf.toString().split('\n')) {
      const t = line.trim();
      if (t && filter(t)) console.log(`  [build] ${t.slice(0, 200)}`);
    }
  });
  child.stderr?.on('data', (buf: Buffer) => {
    const t = buf.toString().trim();
    if (t) console.error(`  [build stderr] ${t.slice(0, 240)}`);
  });

  const monitor = child.pid
    ? startProcessMonitor(child.pid, 1000, (s) => {
        /* quiet unless long builds — status every 5s handled by caller progress */
        void s;
      })
    : undefined;

  try {
    await new Promise<void>((resolvePromise, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolvePromise();
        else reject(new Error(`Build exited with code ${code}`));
      });
      child.on('error', reject);
    });
  } finally {
    monitor?.stop();
  }

  const buildTimeSec = (performance.now() - started) / 1000;
  const processMetrics = monitor
    ? finalizeSamples(monitor.acc)
    : {
        maxMemoryMb: 0,
        minMemoryMb: 0,
        avgMemoryMb: 0,
        maxCpuPct: 0,
        minCpuPct: 0,
        avgCpuPct: 0,
      };

  const bundle = target.bundle ? measureBundle(resolve(target.root), target.bundle) : undefined;

  return { buildTimeSec, ...processMetrics, bundle };
}
