import { defineCommand } from 'citty';
import { consola } from 'consola';
import { execSync } from 'node:child_process';
import { findMonorepoRoot } from '../utils/workspace';

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
  'pnpm run test:pack',
  'pnpm run test:ai',
];

export const preflightCommand = defineCommand({
  meta: {
    name: 'preflight',
    description: 'Full monorepo check chain (lint → format → types → tests → build)',
  },
  async run() {
    const root = findMonorepoRoot();
    if (!root) {
      consola.error('preflight is for the untestutils monorepo only');
      process.exitCode = 1;
      return;
    }
    for (const step of STEPS) {
      consola.info(`>>> ${step}`);
      execSync(step, { cwd: root, stdio: 'inherit' });
    }
    consola.success('preflight ok');
  },
});
