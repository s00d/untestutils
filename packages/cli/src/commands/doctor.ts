import { defineCommand, type CommandDef } from 'citty';
import { consola } from 'consola';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'pathe';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { findMonorepoRoot } from '../utils/workspace';

type Check = { ok: boolean; label: string; hint?: string; optional?: boolean };

function canResolve(id: string, cwd: string): boolean {
  try {
    const req = createRequire(join(cwd, 'package.json'));
    req.resolve(id);
    return true;
  } catch {
    return false;
  }
}

function readPkgVersion(id: string, cwd: string): string | undefined {
  try {
    const req = createRequire(join(cwd, 'package.json'));
    const pkgJson = req.resolve(`${id}/package.json`);
    const ver = (JSON.parse(readFileSync(pkgJson, 'utf8')) as { version?: string }).version;
    return ver;
  } catch {
    return undefined;
  }
}

function findRecipesFile(cwd: string): string | undefined {
  for (const rel of ['recipes.ts', 'tests/recipes.ts', 'e2e/recipes.ts', 'recipes.mts']) {
    const p = join(cwd, rel);
    if (existsSync(p)) return p;
  }
  return undefined;
}

function hasPlaywrightConfig(cwd: string): boolean {
  return ['playwright.config.ts', 'playwright.config.mts', 'playwright.config.js'].some((f) =>
    existsSync(join(cwd, f)),
  );
}

function fileMentions(cwd: string, needle: string): boolean {
  const candidates = [
    'recipes.ts',
    'vitest.config.ts',
    'vitest.config.mts',
    'playwright.config.ts',
    'package.json',
  ];
  for (const rel of candidates) {
    const p = join(cwd, rel);
    if (!existsSync(p)) continue;
    try {
      if (readFileSync(p, 'utf8').includes(needle)) return true;
    } catch {
      /* skip */
    }
  }
  return false;
}

async function runDoctorChecks(cwd: string): Promise<number> {
  const checks: Check[] = [];
  const mono = findMonorepoRoot(cwd);
  const inMono = Boolean(mono && (cwd === mono || cwd.startsWith(`${mono}/`)));

  const major = Number(process.versions.node.split('.')[0]);
  checks.push({
    ok: major >= 20,
    label: `Node.js ${process.version}`,
    hint: 'Requires Node >= 20',
  });

  for (const id of ['untestutils', 'vitest'] as const) {
    checks.push({
      ok: canResolve(id, cwd) || inMono,
      label: `package ${id}`,
      hint: `pnpm add -D ${id}`,
    });
  }

  const vitestVer = readPkgVersion('vitest', cwd);
  if (vitestVer) {
    const vitestMajor = Number(vitestVer.split('.')[0]);
    checks.push({
      ok: vitestMajor === 4 || vitestMajor === 5,
      label: `vitest major ${vitestMajor} (${vitestVer})`,
      hint: 'Supported majors: 4 or 5 (peer ^4 || ^5)',
    });
  } else if (!inMono) {
    checks.push({
      ok: false,
      label: 'vitest version',
      hint: 'pnpm add -D vitest@^4 || vitest@^5',
    });
  }

  const needsPw = hasPlaywrightConfig(cwd);
  const hasPw = canResolve('@playwright/test', cwd) || inMono;
  checks.push({
    ok: !needsPw || hasPw,
    optional: !needsPw,
    label: needsPw ? '@playwright/test (playwright.config present)' : 'optional: @playwright/test',
    hint: 'pnpm add -D @playwright/test playwright-core',
  });

  for (const id of ['playwright-core', 'nuxt', '@untestutils/nuxt'] as const) {
    const ok = canResolve(id, cwd) || (inMono && id !== 'nuxt' && id !== '@untestutils/nuxt');
    checks.push({
      ok,
      optional: true,
      label: `optional: ${id}`,
      hint: ok ? undefined : `needed for the matching preset (pnpm add -D ${id})`,
    });
  }

  if (fileMentions(cwd, 'untestutils/perf') || fileMentions(cwd, '@untestutils/perf')) {
    const ok = canResolve('@untestutils/perf', cwd) || inMono;
    checks.push({
      ok,
      optional: true,
      label: 'optional: @untestutils/perf (imported)',
      hint: ok ? undefined : 'pnpm add -D @untestutils/perf',
    });
  }

  if (fileMentions(cwd, 'untestutils/ai') || fileMentions(cwd, '@untestutils/ai')) {
    const ok = canResolve('@untestutils/ai', cwd) || inMono;
    checks.push({
      ok,
      optional: true,
      label: 'optional: @untestutils/ai (imported)',
      hint: ok ? undefined : 'pnpm add -D @untestutils/ai',
    });
  }

  const configCandidates = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.js',
    'playwright.config.ts',
    'playwright.config.mts',
    'vitest.unit.config.ts',
  ];
  const hasConfig = inMono || configCandidates.some((f) => existsSync(join(cwd, f)));
  checks.push({
    ok: hasConfig,
    label: 'vitest/playwright config',
    hint: 'untestutils init --preset vitest',
  });

  const recipesFile = findRecipesFile(cwd);
  checks.push({
    ok: inMono || Boolean(recipesFile),
    label: 'recipes.ts',
    hint: 'create defineRecipes(...) or run init',
  });

  let failed = 0;
  for (const c of checks) {
    if (c.ok) {
      consola.success(c.label);
    } else if (c.optional) {
      consola.info(`${c.label}${c.hint ? ` — ${c.hint}` : ''}`);
    } else {
      failed++;
      consola.error(`${c.label}${c.hint ? ` — ${c.hint}` : ''}`);
    }
  }
  return failed;
}

async function listRecipes(cwd: string): Promise<void> {
  const recipesFile = findRecipesFile(cwd);
  if (!recipesFile) {
    consola.error('No recipes.ts found (looked for recipes.ts, tests/recipes.ts, e2e/recipes.ts)');
    process.exitCode = 1;
    return;
  }
  consola.start(`Loading ${recipesFile}`);
  try {
    const mod = (await import(pathToFileURL(recipesFile).href)) as {
      recipes?: Record<string, { id?: string }>;
    };
    const map = mod.recipes;
    if (!map || typeof map !== 'object') {
      consola.error('recipes module must export `recipes` from defineRecipes(...)');
      process.exitCode = 1;
      return;
    }
    const ids = Object.entries(map).map(([key, recipe]) => recipe?.id ?? key);
    if (ids.length === 0) {
      consola.warn('No recipes registered');
      return;
    }
    consola.success(`Recipes (${ids.length}):`);
    for (const id of ids.sort()) {
      consola.log(`  - ${id}`);
    }
  } catch (e) {
    consola.error(`Failed to load recipes: ${e}`);
    consola.info('Ensure dependencies are installed and the recipes module can be imported.');
    process.exitCode = 1;
  }
}

const doctorArgs = {
  cwd: {
    type: 'string',
    description: 'Project directory',
    default: '.',
  },
  recipes: {
    type: 'boolean',
    description: 'List recipe ids from defineRecipes export',
    default: false,
  },
} as const;

export const doctorCommand: CommandDef<typeof doctorArgs> = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Check untestutils environment and configs (use --recipes to list ids)',
  },
  args: doctorArgs,
  async run({ args }) {
    const cwd = resolve(String(args.cwd));
    if (args.recipes) {
      await listRecipes(cwd);
      return;
    }
    const failed = await runDoctorChecks(cwd);
    if (failed > 0) {
      consola.warn(`Issues: ${failed}`);
      process.exitCode = 1;
    } else {
      consola.success('Environment looks good');
    }
  },
});
