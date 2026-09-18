import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineCommand } from 'citty'
import { commands } from './commands'

function readOwnVersion(): string {
  try {
    const req = createRequire(import.meta.url)
    // published: dist/cli-run.mjs → ../package.json ; monorepo facade/cli package.json
    for (const cand of [
      join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
      join(dirname(fileURLToPath(import.meta.url)), '../../package.json'),
    ]) {
      try {
        const pkg = req(cand) as { name?: string; version?: string }
        if (pkg.version && (pkg.name === 'untestutils' || pkg.name === '@untestutils/cli')) {
          return pkg.version
        }
      } catch {
        /* try next */
      }
    }
  } catch {
    /* fall through */
  }
  return '0.0.0'
}

export const main = defineCommand({
  meta: {
    name: 'untestutils',
    version: readOwnVersion(),
    description: [
      'CLI for untestutils: init, AI generate/fix/cover, doctor, monorepo helpers.',
      '',
      'Examples:',
      '  untestutils init --preset vitest',
      '  untestutils fix tests/e2e/broken.test.ts --run "pnpm vitest run tests/e2e/broken.test.ts"',
      '  untestutils cover --base-url http://127.0.0.1:3000 --recipes site',
      '  untestutils doctor',
      '  untestutils --help',
    ].join('\n'),
  },
  subCommands: commands,
})
