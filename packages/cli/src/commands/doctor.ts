import { defineCommand, type CommandDef } from 'citty';
import { consola } from 'consola';
import { existsSync } from 'node:fs';
import { resolve, join } from 'pathe';
import { createRequire } from 'node:module';
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

const doctorArgs = {
  cwd: {
    type: 'string',
    description: 'Project directory',
    default: '.',
  },
} as const;

export const doctorCommand: CommandDef<typeof doctorArgs> = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Check untestutils environment and configs',
  },
  args: doctorArgs,
  async run({ args }) {
    const cwd = resolve(String(args.cwd));
    const checks: Check[] = [];
    const mono = findMonorepoRoot(cwd);

    const major = Number(process.versions.node.split('.')[0]);
    checks.push({
      ok: major >= 20,
      label: `Node.js ${process.version}`,
      hint: 'Requires Node >= 20',
    });

    for (const id of ['untestutils', 'vitest'] as const) {
      checks.push({
        ok: canResolve(id, cwd) || Boolean(mono),
        label: `package ${id}`,
        hint: `pnpm add -D ${id}`,
      });
    }

    for (const id of ['@playwright/test', 'playwright-core', 'nuxt'] as const) {
      const ok = canResolve(id, cwd) || (Boolean(mono) && id !== 'nuxt');
      checks.push({
        ok,
        optional: true,
        label: `optional: ${id}`,
        hint: ok ? undefined : `needed for the matching preset (pnpm add -D ${id})`,
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
    const hasConfig = Boolean(mono) || configCandidates.some((f) => existsSync(join(cwd, f)));
    checks.push({
      ok: hasConfig,
      label: 'vitest/playwright config',
      hint: 'untestutils init --preset vitest',
    });

    const hasRecipes =
      Boolean(mono) ||
      existsSync(join(cwd, 'recipes.ts')) ||
      existsSync(join(cwd, 'tests/recipes.ts')) ||
      existsSync(join(cwd, 'e2e/recipes.ts'));
    checks.push({
      ok: hasRecipes,
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

    if (failed > 0) {
      consola.warn(`Issues: ${failed}`);
      process.exitCode = 1;
    } else {
      consola.success('Environment looks good');
    }
  },
});
