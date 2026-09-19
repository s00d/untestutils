/**
 * CLI dogfood: init presets into temp dirs with packed workspace packages, then smoke.
 *
 * - vitest / playwright: init → install from tgz → run smoke tests
 * - nuxt: init → assert fixture files → doctor (no full Nuxt e2e — too heavy for every PR)
 */
import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'pathe';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PACK_PKGS = [
  'packages/core',
  'packages/nuxt',
  'packages/utils',
  'packages/vitest',
  'packages/playwright',
  'packages/perf',
  'packages/ai',
  'packages/cli',
  'packages/vitest-environment-untestutils',
  'packages/untestutils',
] as const;

function run(cmd: string, args: string[], cwd: string) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
}

function readInstalledVersion(name: string, fallback: string): string {
  const pkgJson = join(ROOT, 'node_modules', ...name.split('/'), 'package.json');
  if (!existsSync(pkgJson)) return fallback;
  return (JSON.parse(readFileSync(pkgJson, 'utf8')) as { version: string }).version;
}

function cli(args: string[]) {
  run('pnpm', ['exec', 'tsx', 'packages/cli/src/run.ts', ...args], ROOT);
}

async function packAll(packDir: string): Promise<Record<string, string>> {
  await mkdir(packDir, { recursive: true });
  const deps: Record<string, string> = {};
  for (const rel of PACK_PKGS) {
    const pkgDir = join(ROOT, rel);
    const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8')) as {
      name: string;
    };
    const out = execSync(`pnpm pack --pack-destination ${JSON.stringify(packDir)}`, {
      cwd: pkgDir,
      encoding: 'utf8',
    });
    const line = out
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .reverse()
      .find((l) => l.endsWith('.tgz'));
    if (!line) throw new Error(`pnpm pack produced no tgz for ${pkg.name}`);
    const tgzPath = line.startsWith('/') ? line : join(packDir, line);
    deps[pkg.name] = `file:${tgzPath}`;
    consola.info(`packed ${pkg.name}`);
  }
  return deps;
}

async function writeConsumerPkg(
  dir: string,
  packed: Record<string, string>,
  extraDev: Record<string, string>,
) {
  const pkgPath = join(dir, 'package.json');
  let existing: Record<string, unknown> = {};
  if (existsSync(pkgPath)) {
    existing = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, unknown>;
  }
  const next = {
    name: (existing.name as string) ?? 'cli-dogfood',
    private: true,
    type: 'module',
    scripts: existing.scripts,
    devDependencies: {
      ...packed,
      ...extraDev,
    },
    pnpm: { overrides: packed },
  };
  await writeFile(pkgPath, JSON.stringify(next, null, 2));
}

const dogfood = defineCommand({
  meta: {
    name: 'cli-dogfood',
    description: 'Temp-dir init dogfood for vitest/playwright/nuxt presets',
  },
  async run() {
    if (!existsSync(join(ROOT, 'pnpm-workspace.yaml'))) {
      consola.error('cli-dogfood is for the untestutils monorepo only');
      process.exitCode = 1;
      return;
    }

    const stamp = await mkdtemp(join(tmpdir(), 'untestutils-cli-dogfood-'));
    const packDir = join(stamp, 'pack');
    consola.start(`Packing workspace packages → ${packDir}`);
    const packed = await packAll(packDir);

    const vitestVer = readInstalledVersion('vitest', '^5.0.0');
    const pwVer = readInstalledVersion('@playwright/test', '^1.63.0');
    const nuxtVer = readInstalledVersion('nuxt', '^3.15.0');

    try {
      // --- vitest ---
      {
        const dir = join(stamp, 'vitest');
        await mkdir(dir);
        consola.start(`init vitest → ${dir}`);
        cli(['init', '--preset', 'vitest', '--cwd', dir, '--no-install', '--pm', 'pnpm']);
        await writeConsumerPkg(dir, packed, { vitest: vitestVer });
        consola.start('pnpm install (vitest dogfood)');
        run('pnpm', ['install', '--no-frozen-lockfile'], dir);
        consola.start('vitest smoke');
        run('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.config.ts'], dir);
        consola.success('vitest preset dogfood ok');
      }

      // --- playwright ---
      {
        const dir = join(stamp, 'playwright');
        await mkdir(dir);
        consola.start(`init playwright → ${dir}`);
        cli(['init', '--preset', 'playwright', '--cwd', dir, '--no-install', '--pm', 'pnpm']);
        await writeConsumerPkg(dir, packed, {
          vitest: vitestVer,
          '@playwright/test': pwVer,
          'playwright-core': pwVer,
        });
        consola.start('pnpm install (playwright dogfood)');
        run('pnpm', ['install', '--no-frozen-lockfile'], dir);
        consola.start('playwright smoke');
        run('pnpm', ['exec', 'playwright', 'install', 'chromium'], dir);
        run('pnpm', ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'], dir);
        consola.success('playwright preset dogfood ok');
      }

      // --- nuxt (files + doctor only) ---
      {
        const dir = join(stamp, 'nuxt');
        await mkdir(dir);
        consola.start(`init nuxt → ${dir}`);
        cli(['init', '--preset', 'nuxt', '--cwd', dir, '--no-install', '--pm', 'pnpm']);
        await access(join(dir, 'fixtures/nuxt/nuxt.config.ts'));
        await access(join(dir, 'fixtures/nuxt/app.vue'));
        await access(join(dir, 'fixtures/nuxt/package.json'));
        await access(join(dir, 'recipes.ts'));
        await access(join(dir, 'vitest.config.ts'));
        await writeConsumerPkg(dir, packed, { vitest: vitestVer, nuxt: nuxtVer });
        consola.start('pnpm install (nuxt dogfood files)');
        run('pnpm', ['install', '--no-frozen-lockfile'], dir);
        consola.start('doctor');
        cli(['doctor', '--cwd', dir]);
        consola.start('doctor --recipes');
        cli(['doctor', '--recipes', '--cwd', dir]);
        consola.success('nuxt preset files + doctor ok');
      }

      consola.success('cli-dogfood passed');
    } finally {
      await rm(stamp, { recursive: true, force: true }).catch(() => undefined);
    }
  },
});

runMain(dogfood);
