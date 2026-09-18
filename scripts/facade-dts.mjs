#!/usr/bin/env node
/**
 * Flatten declaration files for the published facade from private package dists.
 */
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const facade = join(root, '../packages/untestutils');
const dist = join(facade, 'dist');
const vendor = join(dist, 'vendor');

if (existsSync(vendor)) rmSync(vendor, { recursive: true });
mkdirSync(vendor, { recursive: true });

const pkgs = [
  'core',
  'utils',
  'perf',
  'drivers',
  'vitest',
  'playwright',
  'nuxt',
  'ai',
  'vite',
  'next',
  'astro',
  'sveltekit',
  'runtime',
  'module',
  'config',
];

for (const name of pkgs) {
  const src = join(root, `../packages/${name}/dist`);
  if (!existsSync(src)) {
    console.warn('skip missing', name);
    continue;
  }
  cpSync(src, join(vendor, name), { recursive: true });
}

// Remove broken nested dts from vite-plugin-dts
for (const junk of pkgs.concat(['untestutils', 'drivers'])) {
  const p = join(dist, junk);
  // keep vendor; remove top-level package-named dirs from broken dts
  if (junk !== 'vendor' && existsSync(p) && junk !== 'chunks') {
    // only remove if it looks like dts tree (has src/)
    if (existsSync(join(p, 'src'))) rmSync(p, { recursive: true });
  }
}

writeFileSync(
  join(dist, 'index.d.ts'),
  `export {
  defineRecipe,
  defineRecipes,
  useHarness,
  getCurrentHarness,
  getHarness,
  ensurePrepared,
  stopAllTargets,
  SCHEMA_VERSION,
  LOOPBACK_HOST,
  loopbackUrl,
  normalizeBaseUrl,
  resolveArtifactsRoot,
  getFreePort,
  waitForHttpReady,
  contentHash,
  FileLock,
  TargetRegistry,
  ArtifactStore,
  envFlag,
  debug,
} from './vendor/core/index.js'
export type {
  Recipe,
  RecipeFactory,
  RecipeRegistry,
  Running,
  HarnessHandle,
  SharePolicy,
  PrepareCtx,
  StartCtx,
  HashCtx,
  UseHarnessOptions,
} from './vendor/core/index.js'
export {
  command,
  staticDir,
  nodeEntry,
  host,
  defineDriver,
} from './vendor/drivers/index.js'
export type {
  CommandOptions,
  StaticDirOptions,
  NodeEntryOptions,
  HostOptions,
  Driver,
} from './vendor/drivers/index.js'
`,
);

const map = {
  'vitest.d.ts': `export * from './vendor/vitest/index.js'\n`,
  'vitest-plugin.d.ts': `export * from './vendor/vitest/plugin.js'\n`,
  'vitest-global-setup.d.ts': `export { default } from './vendor/vitest/global-setup.js'\n`,
  'vitest-setup-file.d.ts': `export {} from './vendor/vitest/setup-file.js'\n`,
  'playwright.d.ts': `export * from './vendor/playwright/index.js'\n`,
  'playwright-pw-global-setup.d.ts': `export { default } from './vendor/playwright/pw-global-setup.js'\n`,
  'playwright-pw-global-teardown.d.ts': `export { default } from './vendor/playwright/pw-global-teardown.js'\n`,
  'nuxt.d.ts': `export * from './vendor/nuxt/index.js'\n`,
  'vite.d.ts': `export * from './vendor/vite/index.js'\n`,
  'next.d.ts': `export * from './vendor/next/index.js'\n`,
  'astro.d.ts': `export * from './vendor/astro/index.js'\n`,
  'sveltekit.d.ts': `export * from './vendor/sveltekit/index.js'\n`,
  'utils.d.ts': `export * from './vendor/utils/index.js'\n`,
  'perf.d.ts': `export * from './vendor/perf/index.js'\n`,
  'command.d.ts': `export { command } from './vendor/drivers/index.js'\nexport type { CommandOptions } from './vendor/drivers/index.js'\n`,
  'runtime.d.ts': `export * from './vendor/runtime/index.js'\n`,
  'module.d.ts': `export * from './vendor/module/index.js'\n`,
  'config.d.ts': `export * from './vendor/config/index.js'\n`,
  'ai.d.ts': `export * from './vendor/ai/index.js'\n`,
};

for (const [file, body] of Object.entries(map)) {
  writeFileSync(join(dist, file), body);
}

console.log('facade dts ready');
