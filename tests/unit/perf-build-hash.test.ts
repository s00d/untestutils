import { describe, expect, test } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { ProcessSampler } from '../../packages/perf/src/process-sample';
import {
  measureBuild,
  isBuildWarm,
  computeBuildHash,
  writeStoredBuildHash,
  resolveBuildHashInputs,
} from '../../packages/perf/src/build';
import { findWorkspaceRoot, workspacePackageSrcDirs } from '@untestutils/core';

describe('perf/build self-mutating root', () => {
  test('second measureBuild is warm after build that writes into root', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-mutate-'));
    try {
      writeFileSync(join(dir, 'app.ts'), 'export const x = 1\n');
      // Simulates micro writing locales into fixture root during build
      const mutator = join(dir, 'mutate.mjs');
      writeFileSync(
        mutator,
        `
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
mkdirSync(join(process.cwd(), '.output'), { recursive: true })
writeFileSync(join(process.cwd(), 'generated-by-build.txt'), 'hi\\n')
writeFileSync(join(process.cwd(), '.output', 'ok'), '1\\n')
`,
      );
      const target = {
        id: 'mutate',
        root: dir,
        build: { command: process.execPath, args: [mutator] },
        start: { command: 'true', port: 1 },
      };

      const first = await measureBuild(target, { force: true });
      expect(first.cached).not.toBe(true);
      expect(existsSync(join(dir, 'generated-by-build.txt'))).toBe(true);

      const second = await measureBuild(target);
      expect(second.cached).toBe(true);
      expect(await isBuildWarm(target)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('perf/build hashInputs with workspace root src', () => {
  test('default resolveBuildHashInputs is only root; consumers need workspace src via hashInputs', async () => {
    const ws = await mkdtemp(join(tmpdir(), 'ut-perf-ws-'));
    try {
      await writeFile(join(ws, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      await mkdir(join(ws, 'src'), { recursive: true });
      await writeFile(join(ws, 'src', 'module.ts'), 'export default 1\n');
      const fixture = join(ws, 'fixture');
      await mkdir(fixture, { recursive: true });
      await writeFile(join(fixture, 'app.ts'), 'x\n');

      const target = {
        id: 'p',
        root: fixture,
        build: { command: 'true' },
        start: { command: 'true', port: 1 },
      };
      const inputs = await resolveBuildHashInputs(target);
      expect(inputs).toEqual([fixture]);

      // With hashInputs that include workspace src (Nuxt-style), warm must invalidate
      mkdirSync(join(fixture, '.output'), { recursive: true });
      const withSrc = {
        ...target,
        build: {
          ...target.build,
          hashInputs: [fixture, join(ws, 'src')],
        },
      };
      const hash = await computeBuildHash(withSrc);
      writeStoredBuildHash(withSrc, hash);
      expect(await isBuildWarm(withSrc)).toBe(true);
      await writeFile(join(ws, 'src', 'module.ts'), 'export default 2\n');
      expect(await isBuildWarm(withSrc)).toBe(false);
    } finally {
      await rm(ws, { recursive: true, force: true });
    }
  });

  test('workspacePackageSrcDirs includes workspace root src when present', async () => {
    const ws = await mkdtemp(join(tmpdir(), 'ut-ws-dirs-'));
    try {
      await writeFile(join(ws, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      await mkdir(join(ws, 'packages', 'a', 'src'), { recursive: true });
      await writeFile(join(ws, 'packages', 'a', 'src', 'a.ts'), '1\n');
      await mkdir(join(ws, 'src'), { recursive: true });
      await writeFile(join(ws, 'src', 'module.ts'), '1\n');
      const fixture = join(ws, 'apps', 'f');
      await mkdir(fixture, { recursive: true });

      expect(findWorkspaceRoot(fixture)).toBe(ws);
      const dirs = await workspacePackageSrcDirs(fixture);
      expect(dirs).toContain(join(ws, 'packages', 'a', 'src'));
      expect(dirs).toContain(join(ws, 'src'));
    } finally {
      await rm(ws, { recursive: true, force: true });
    }
  });
});

describe('ProcessSampler process tree', () => {
  test('finalize includes descendant RSS when child allocates memory', async () => {
    // Parent: spawn child that holds ~40MB, then sleep; sampler watches parent only vs tree
    const script = `
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['-e', 'const b=Buffer.alloc(40*1024*1024);b.fill(1);setTimeout(()=>{}, 8000)'], {
  stdio: 'ignore',
});
setTimeout(() => {}, 8000);
process.on('SIGTERM', () => { try { child.kill(); } catch {} process.exit(0); });
`;
    const dir = await mkdtemp(join(tmpdir(), 'ut-samp-'));
    const file = join(dir, 'parent.mjs');
    await writeFile(file, script);
    const child = spawn(process.execPath, [file], { stdio: 'ignore' });
    try {
      await new Promise((r) => setTimeout(r, 400));
      const sampler = new ProcessSampler(child.pid!);
      sampler.begin();
      await new Promise((r) => setTimeout(r, 300));
      sampler.note();
      const m = sampler.finalize();
      // Tree sampling should see ~40MB+ from the grandchild allocator
      expect(m.maxMemoryMb).toBeGreaterThan(30);
    } finally {
      child.kill('SIGTERM');
      await rm(dir, { recursive: true, force: true });
    }
  }, 15_000);
});
