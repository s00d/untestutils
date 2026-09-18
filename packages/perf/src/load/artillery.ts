import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'pathe';
import type { ArtilleryResult } from '../types';

function resolveArtilleryBin(): string | null {
  try {
    const pkg = createRequire(import.meta.url).resolve('artillery/package.json');
    const bin = join(dirname(pkg), 'bin', 'run');
    return existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}

function spawnArtillery(
  args: string[],
  opts: { cwd?: string; outputFile: string },
): Promise<ArtilleryResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(args[0]!, args.slice(1), {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (
        line.includes('Phase started') ||
        line.includes('Summary report') ||
        line.includes('All VUs finished')
      ) {
        console.log(`  [artillery] ${line.split('\n')[0]}`);
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) console.error(`  [artillery stderr] ${line.slice(0, 200)}`);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Artillery exited with code ${code}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(readFileSync(opts.outputFile, 'utf8')) as ArtilleryResult);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/** Prefer local artillery bin; fall back to `npx artillery`. */
export async function runArtillery(opts: {
  configPath: string;
  artifactsDir: string;
  name: string;
  cwd?: string;
  /** Overrides `config.target` (needed when the suite picks a free port). */
  targetUrl?: string;
}): Promise<ArtilleryResult> {
  mkdirSync(opts.artifactsDir, { recursive: true });
  const outputFile = join(opts.artifactsDir, `artillery-${opts.name}.json`);
  const config = resolve(opts.configPath);
  const bin = resolveArtilleryBin();
  const targetArgs = opts.targetUrl ? ['--target', opts.targetUrl.replace(/\/$/, '')] : [];
  const args = bin
    ? [process.execPath, bin, 'run', ...targetArgs, config, '--output', outputFile]
    : ['npx', '--yes', 'artillery', 'run', ...targetArgs, config, '--output', outputFile];

  return spawnArtillery(args, { cwd: opts.cwd, outputFile });
}
