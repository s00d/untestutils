#!/usr/bin/env node
/**
 * Flatten declaration files for the published facade from private package dists.
 *
 * Critical: vendor .d.ts must NOT retain `@untestutils/*` imports (those packages
 * are private and never published). Also rewrite extension-less relative imports
 * so NodeNext / bundler resolution works for consumers.
 */
import {
  cpSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const facade = join(root, '../packages/untestutils')
const dist = join(facade, 'dist')
const vendor = join(dist, 'vendor')

if (existsSync(vendor)) rmSync(vendor, { recursive: true })
mkdirSync(vendor, { recursive: true })

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
]

for (const name of pkgs) {
  const src = join(root, `../packages/${name}/dist`)
  if (!existsSync(src)) {
    console.warn('skip missing', name)
    continue
  }
  cpSync(src, join(vendor, name), { recursive: true })
}

// Remove broken nested dts from vite-plugin-dts
for (const junk of pkgs.concat(['untestutils', 'drivers'])) {
  const p = join(dist, junk)
  if (junk !== 'vendor' && existsSync(p) && junk !== 'chunks') {
    if (existsSync(join(p, 'src'))) rmSync(p, { recursive: true })
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
)

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
}

for (const [file, body] of Object.entries(map)) {
  writeFileSync(join(dist, file), body)
}

function walkDts(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walkDts(p, out)
    else if (p.endsWith('.d.ts')) out.push(p)
  }
  return out
}

/** Map `@untestutils/<pkg>[/sub]` → path to that package's dist entry under vendor. */
function resolveWorkspaceImport(spec, fromFile) {
  const m = /^@untestutils\/([^/]+)(?:\/(.*))?$/.exec(spec)
  if (!m) return null
  const [, pkg, sub] = m
  const base = join(vendor, pkg)
  let target
  if (!sub) {
    target = join(base, 'index.d.ts')
  } else {
    const asFile = join(base, `${sub}.d.ts`)
    const asIndex = join(base, sub, 'index.d.ts')
    if (existsSync(asFile)) target = asFile
    else if (existsSync(asIndex)) target = asIndex
    else target = asFile
  }
  let rel = relative(dirname(fromFile), target).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = `./${rel}`
  // TS NodeNext wants .js in import paths (resolves to .d.ts)
  return rel.replace(/\.d\.ts$/, '.js')
}

function addJsExtension(spec, fromFile) {
  if (!spec.startsWith('.')) return spec
  if (/\.(js|mjs|cjs|json|d\.ts)$/.test(spec)) return spec

  const base = resolve(dirname(fromFile), spec)
  if (existsSync(`${base}.d.ts`)) return `${spec}.js`
  if (existsSync(join(base, 'index.d.ts'))) return `${spec}/index.js`
  // fallback: assume file
  return `${spec}.js`
}

function rewriteDtsFile(file) {
  let src = readFileSync(file, 'utf8')
  let changed = false

  src = src.replace(
    /(from\s+|(?:import|export)\s*\(\s*)['"]([^'"]+)['"]/g,
    (full, prefix, spec) => {
      let next = spec
      const ws = resolveWorkspaceImport(spec, file)
      if (ws) next = ws
      else if (spec.startsWith('.')) next = addJsExtension(spec, file)
      if (next !== spec) {
        changed = true
        return `${prefix}'${next}'`
      }
      return full
    },
  )

  // export type * from './x'
  src = src.replace(/export type \* from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    const next = addJsExtension(spec, file)
    if (next !== spec) {
      changed = true
      return `export type * from '${next}'`
    }
    return full
  })

  if (changed) writeFileSync(file, src)
}

for (const file of walkDts(vendor)) rewriteDtsFile(file)

for (const name of readdirSync(dist)) {
  if (!name.endsWith('.d.ts')) continue
  rewriteDtsFile(join(dist, name))
}

const leftover = []
for (const file of walkDts(dist)) {
  const src = readFileSync(file, 'utf8')
  if (src.includes('@untestutils/')) leftover.push(relative(dist, file))
}
if (leftover.length) {
  console.error('facade dts still references @untestutils/*:', leftover)
  process.exit(1)
}

console.log('facade dts ready')
