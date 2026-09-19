import { defineCommand, runMain } from 'citty';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_BRANCHES = new Set(['master', 'main']);
const NESTED = [
  'packages/untestutils/vitest-environment-untestutils/package.json',
  'packages/untestutils/vitest-environment-nuxt/package.json',
];

function run(cmd: string, args: string[]) {
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
}
function out(cmd: string, args: string[]) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function ok(cmd: string, args: string[]) {
  try {
    execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}
function log(m: string) {
  console.log(`[release] ${m}`);
}
function fail(m: string): never {
  console.error(`[release] ${m}`);
  process.exit(1);
}

const release = defineCommand({
  meta: {
    name: 'release',
    description: 'Lockstep bumpp → changelog → tag → pnpm -r publish → gh release',
  },
  args: {
    bump: {
      type: 'positional',
      description: 'patch | minor | major',
      required: true,
    },
    dryRun: {
      type: 'boolean',
      description: 'Preview changelog only',
      default: false,
    },
    noPublish: {
      type: 'boolean',
      description: 'Commit + tag locally, skip publish/push/gh',
      default: false,
    },
  },
  async run({ args }) {
    const bump = String(args.bump);
    if (!['patch', 'minor', 'major'].includes(bump)) {
      fail('bump must be patch | minor | major');
    }
    const dryRun = Boolean(args.dryRun);
    const noPublish = Boolean(args.noPublish);

    const status = out('git', ['status', '--porcelain']);
    if (status) fail(`Working tree dirty:\n${status}`);
    const branch = out('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (!RELEASE_BRANCHES.has(branch)) fail(`Must release from master|main (current: ${branch})`);

    if (!dryRun && !noPublish) {
      if (!ok('npm', ['whoami'])) fail('Not logged in to npm (`npm login`)');
      if (!ok('gh', ['auth', 'status'])) fail('GitHub CLI required (`gh auth login`)');
    }

    const tags = out('git', ['tag', '-l', 'v*', '--sort=-v:refname'])
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
    const from =
      tags.find((t) => ok('git', ['merge-base', '--is-ancestor', t, 'HEAD'])) ||
      out('git', ['rev-list', '--max-parents=0', 'HEAD']).split('\n')[0]!;
    log(`changelog from ${from}`);

    log('building…');
    run('pnpm', ['run', 'build']);

    if (dryRun) {
      run('pnpm', ['exec', 'changelogen', '--from', from]);
      log(
        `dry-run ok — would bumpp ${bump} -r, changelogen, commit/tag, pnpm -r publish, push, gh release`,
      );
      return;
    }

    log(`bumpp ${bump} (recursive, no commit/tag yet)…`);
    run('pnpm', [
      'exec',
      'bumpp',
      '-r',
      '--all',
      '--release',
      bump,
      '--no-commit',
      '--no-tag',
      '--no-push',
      '--yes',
    ]);

    const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version as string;
    const tag = `v${version}`;
    log(`version → ${version}`);

    const pkgDirs = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(ROOT, 'packages', d.name, 'package.json'))
      .filter((p) => existsSync(p));
    const allJson = [...pkgDirs, ...NESTED.map((r) => join(ROOT, r)).filter(existsSync)];
    for (const path of allJson) {
      const pkg = JSON.parse(readFileSync(path, 'utf8')) as {
        version?: string;
        peerDependencies?: Record<string, string>;
      };
      let changed = pkg.version !== version;
      pkg.version = version;
      const peers = pkg.peerDependencies;
      if (peers) {
        for (const name of Object.keys(peers)) {
          if (name.startsWith('@untestutils/') || name === 'vitest-environment-untestutils') {
            if (peers[name] !== version) {
              peers[name] = version;
              changed = true;
            }
          }
        }
      }
      if (changed) writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    }

    run('pnpm', ['exec', 'changelogen', '--from', from, '--output', 'CHANGELOG.md']);
    {
      const p = join(ROOT, 'CHANGELOG.md');
      if (existsSync(p)) {
        let md = readFileSync(p, 'utf8');
        if (!md.startsWith(`## v${version}`) && !md.includes(`## v${version}\n`)) {
          md = md.replace(/^## .+$/m, `## v${version}`);
          writeFileSync(p, md);
        }
      }
    }

    run('git', ['add', 'package.json', 'CHANGELOG.md', 'packages', 'pnpm-lock.yaml']);
    run('git', ['commit', '-m', `chore(release): ${tag}`]);
    run('git', ['tag', tag]);
    log(`tagged ${tag}`);

    if (!noPublish) {
      log('publishing (pnpm rewrites workspace:* on pack)…');
      run('pnpm', [
        '-r',
        '--filter',
        './packages/**',
        'publish',
        '--access',
        'public',
        '--no-git-checks',
        '--publish-branch',
        branch,
      ]);
      run('git', ['push', '--follow-tags']);
      run('gh', ['release', 'create', tag, '--title', tag, '--generate-notes', '--latest']);
    } else {
      log('skipped publish/push/gh (--no-publish)');
    }

    log(`done ${tag}`);
  },
});

process.argv = process.argv.filter((arg) => arg !== '--');
runMain(release);
