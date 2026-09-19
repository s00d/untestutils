import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'pathe';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STEPS = [
  'pnpm run lint',
  'pnpm run format:check',
  'pnpm run typecheck',
  'pnpm run test:unit',
  'pnpm run test:types',
  'pnpm run test:integration',
  'pnpm run build',
  'pnpm run publint',
  'pnpm run test:dist',
  'pnpm run api:surface',
  'pnpm run test:playground',
  'pnpm run test:playground:unit',
  'pnpm run test:pack',
  'pnpm run test:ai',
];

const preflight = defineCommand({
  meta: {
    name: 'preflight',
    description: 'Full monorepo check chain (lint → format → types → tests → build)',
  },
  async run() {
    if (!existsSync(join(ROOT, 'pnpm-workspace.yaml'))) {
      consola.error('preflight is for the untestutils monorepo only');
      process.exitCode = 1;
      return;
    }
    for (const step of STEPS) {
      consola.info(`>>> ${step}`);
      execSync(step, { cwd: ROOT, stdio: 'inherit' });
    }
    consola.success('preflight ok');
  },
});

runMain(preflight);
