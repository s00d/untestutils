/**
 * Unified monorepo release:
 *   1. bump root + sync version to every packages/<name>/package.json
 *   2. regenerate CHANGELOG.md via changelogen
 *   3. commit + tag vX.Y.Z
 *   4. publish public npm packages (currently: untestutils)
 *   5. push + gh release
 *
 * Usage:
 *   pnpm release:patch
 *   pnpm release:minor
 *   pnpm release:major
 *   pnpm release:patch -- --dry-run
 *   pnpm release:patch -- --no-publish
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUMPS = ['patch', 'minor', 'major'] as const
type Bump = (typeof BUMPS)[number]

/** Only these leave the monorepo. Internals stay private and are bundled into the facade. */
const PUBLISH_PACKAGES = ['untestutils'] as const

/** Strict semver bump (changelogen treats 0.x "minor" like a patch). */
function forceSemverBump(current: string, bump: Bump): string {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(current)
  if (!m) fail(`Cannot parse version: ${current}`)
  const major = Number(m[1])
  const minor = Number(m[2])
  const patch = Number(m[3])
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

const RELEASE_BRANCHES = new Set(['master', 'main'])

function log(msg: string) {
  console.log(`[release] ${msg}`)
}

function fail(msg: string): never {
  console.error(`[release] ${msg}`)
  process.exit(1)
}

function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
  execFileSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
  })
}

function runOut(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function tryOk(cmd: string, args: string[]): boolean {
  try {
    execFileSync(cmd, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

function writeJson(path: string, data: Record<string, unknown>) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

function parseArgs(argv: string[]) {
  const bump = argv[0] as Bump | undefined
  if (!bump || !BUMPS.includes(bump)) {
    fail(`Usage: tsx scripts/release.ts <${BUMPS.join('|')}> [--dry-run] [--no-publish]`)
  }
  return {
    bump,
    dryRun: argv.includes('--dry-run'),
    noPublish: argv.includes('--no-publish'),
  }
}

function assertCleanTree() {
  const status = runOut('git', ['status', '--porcelain'])
  if (status) fail(`Working tree dirty:\n${status}`)
}

function assertReleaseBranch() {
  const branch = runOut('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (!RELEASE_BRANCHES.has(branch)) {
    fail(`Must release from ${[...RELEASE_BRANCHES].join('|')} (current: ${branch})`)
  }
}

function resolveFromRef(): string {
  const tags = runOut('git', ['tag', '-l', 'v*', '--sort=-v:refname'])
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))

  for (const tag of tags) {
    if (tryOk('git', ['merge-base', '--is-ancestor', tag, 'HEAD'])) return tag
  }

  const root = runOut('git', ['rev-list', '--max-parents=0', 'HEAD']).split('\n')[0]
  if (!root) fail('Could not resolve initial commit for changelog --from')
  log(`No v* tags yet — changelog from ${root.slice(0, 7)}`)
  return root
}

function packageDirs(): string[] {
  return readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(ROOT, 'packages', name, 'package.json')))
}

/** Sync canonical root version into every package under packages/. */
function syncWorkspaceVersions(version: string): string[] {
  const touched: string[] = []
  for (const name of packageDirs()) {
    const path = join(ROOT, 'packages', name, 'package.json')
    const pkg = readJson(path)
    if (pkg.version === version) continue
    pkg.version = version
    writeJson(path, pkg)
    touched.push(`packages/${name}/package.json`)
  }
  return touched
}

function resolvePackageDir(pkgName: string): string {
  const dir = packageDirs().find((d) => {
    const pkg = readJson(join(ROOT, 'packages', d, 'package.json'))
    return pkg.name === pkgName
  })
  if (!dir) fail(`Publish package not found: ${pkgName}`)
  return dir
}

function assertPublishable(pkgName: string) {
  const dir = resolvePackageDir(pkgName)
  const path = join(ROOT, 'packages', dir, 'package.json')
  const pkg = readJson(path)
  if (pkg.private === true) fail(`${pkgName} is private — cannot publish`)

  for (const field of ['dependencies', 'optionalDependencies'] as const) {
    const deps = pkg[field] as Record<string, string> | undefined
    if (!deps) continue
    for (const [dep, range] of Object.entries(deps)) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        fail(
          `${pkgName} still has workspace protocol on ${field}.${dep} (${range}). ` +
            'Bundle internals or publish the dependency first.',
        )
      }
    }
  }
  return dir
}

function ensureNpmAuth() {
  if (!tryOk('npm', ['whoami'])) {
    fail('Not logged in to npm. Run `npm login` (or set NPM_TOKEN) before release.')
  }
  log(`npm auth ok (${runOut('npm', ['whoami'])})`)
}

function ensureGh() {
  if (!tryOk('gh', ['auth', 'status'])) {
    fail('GitHub CLI `gh` is required and must be authenticated (`gh auth login`).')
  }
}

function stageReleaseFiles(synced: string[]) {
  run('git', ['add', 'package.json', 'CHANGELOG.md'])
  for (const name of packageDirs()) {
    run('git', ['add', `packages/${name}/package.json`])
  }
  for (const f of synced) run('git', ['add', f])
}

async function main() {
  const { bump, dryRun, noPublish } = parseArgs(process.argv.slice(2))
  log(`bump=${bump} dryRun=${dryRun} noPublish=${noPublish}`)

  assertCleanTree()
  assertReleaseBranch()

  if (!dryRun && !noPublish) {
    ensureNpmAuth()
    ensureGh()
  }

  const from = resolveFromRef()
  log(`changelog from ${from}`)

  log('building…')
  run('pnpm', ['run', 'build'])

  if (dryRun) {
    log('dry-run: preview changelog (no bump / commit / publish)')
    run('pnpm', ['exec', 'changelogen', '--from', from])
    log(
      `dry-run complete — would: changelogen --bump --${bump}, sync packages/*, ` +
        `commit+tag, publish [${PUBLISH_PACKAGES.join(', ')}], push, gh release`,
    )
    return
  }

  const beforePkg = readJson(join(ROOT, 'package.json'))
  const expectedVersion = forceSemverBump(String(beforePkg.version), bump)

  // Bump root package.json + write CHANGELOG.md (no git commit yet).
  run('pnpm', [
    'exec',
    'changelogen',
    '--bump',
    `--${bump}`,
    '--from',
    from,
    '--output',
    'CHANGELOG.md',
  ])

  const rootPkg = readJson(join(ROOT, 'package.json'))
  let version = String(rootPkg.version)
  if (version !== expectedVersion) {
    log(`changelogen produced ${version}; forcing semver ${bump} → ${expectedVersion}`)
    rootPkg.version = expectedVersion
    writeJson(join(ROOT, 'package.json'), rootPkg)
    version = expectedVersion
    const changelogPath = join(ROOT, 'CHANGELOG.md')
    if (existsSync(changelogPath)) {
      const md = readFileSync(changelogPath, 'utf8')
      // Rewrite first changelog heading + compare URL fragment if present
      writeFileSync(
        changelogPath,
        md
          .replace(/^## v\d+\.\d+\.\d+/m, `## v${expectedVersion}`)
          .replace(
            new RegExp(`\\.\\.\\.v${version.replace(/\./g, '\\.')}`),
            `...v${expectedVersion}`,
          ),
      )
    }
  }
  if (!/^\d+\.\d+\.\d+/.test(version)) fail(`Invalid version after bump: ${version}`)
  const tag = `v${version}`
  log(`version → ${version}`)

  const synced = syncWorkspaceVersions(version)
  log(`synced ${synced.length} package.json files`)

  for (const name of PUBLISH_PACKAGES) assertPublishable(name)

  stageReleaseFiles(synced)
  run('git', ['commit', '-m', `chore(release): ${tag}`])
  run('git', ['tag', tag])
  log(`tagged ${tag}`)

  if (!noPublish) {
    for (const name of PUBLISH_PACKAGES) {
      assertPublishable(name)
      log(`publishing ${name}…`)
      // Prefer filter publish from root so workspace metadata is correct.
      // Do not pass --no-git-checks: current npm rejects the forwarded --git-checks flag.
      run('pnpm', ['--filter', name, 'publish', '--access', 'public', '--publish-branch', 'master'])
    }

    log('pushing commit + tags…')
    run('git', ['push'])
    run('git', ['push', 'origin', tag])

    log(`creating GitHub Release ${tag}…`)
    run('gh', ['release', 'create', tag, '--title', tag, '--generate-notes', '--latest'])
  } else {
    log('skipped publish/push/gh (--no-publish). Local commit + tag created.')
  }

  log(`done ${tag}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
