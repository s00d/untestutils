import { defineCommand } from 'citty';
import { consola } from 'consola';
import { readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { execSync } from 'node:child_process';
import { fixBrokenTests } from '@untestutils/ai';
import { pathExists, writeText } from '../utils/fs';

export const fixCommand = defineCommand({
  meta: {
    name: 'fix',
    description: 'Fix a broken untestutils test via AI (failure log + optional browser tools)',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Failing test file',
      required: true,
    },
    log: {
      type: 'string',
      description: 'Path to failure log file (or use --run)',
      alias: 'l',
    },
    run: {
      type: 'string',
      description: 'Shell command that fails (stdout/stderr captured as log)',
    },
    root: {
      type: 'string',
      description: 'Project root',
      default: '.',
    },
    recipes: {
      type: 'string',
      description: 'Comma-separated recipe ids',
      default: '',
    },
    'base-url': {
      type: 'string',
      description: 'App base URL for Playwright page tools',
    },
    browser: {
      type: 'boolean',
      description: 'Enable browser tools even without --base-url',
      default: false,
    },
    write: {
      type: 'boolean',
      description: 'Overwrite the failing file in place',
      default: true,
    },
    out: {
      type: 'string',
      description: 'Write fixed source to this path instead',
    },
  },
  async run({ args }) {
    const file = resolve(String(args.path));
    if (!(await pathExists(file))) {
      consola.error(`File not found: ${file}`);
      process.exitCode = 1;
      return;
    }

    let failureLog = '';
    if (args.log) {
      failureLog = await readFile(resolve(String(args.log)), 'utf8');
    } else if (args.run) {
      consola.start(`Running: ${args.run}`);
      try {
        execSync(String(args.run), {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: resolve(String(args.root)),
        });
        consola.warn('Command succeeded — nothing to fix');
        return;
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; message?: string };
        failureLog = `${err.stdout ?? ''}\n${err.stderr ?? ''}\n${err.message ?? ''}`;
      }
    } else {
      consola.error('Provide --log <file> or --run "<test command>"');
      process.exitCode = 1;
      return;
    }

    const recipes = String(args.recipes || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    consola.start(`Fixing ${file}`);
    const result = await fixBrokenTests({
      path: file,
      root: resolve(String(args.root)),
      failureLog,
      recipes,
      baseURL: args['base-url'] ? String(args['base-url']) : undefined,
      browser: Boolean(args.browser || args['base-url']),
      write: false,
    });

    const outPath = args.out ? resolve(String(args.out)) : file;
    if (args.write || args.out) {
      await writeText(outPath, result.code);
      consola.success(`Wrote ${outPath}`);
    } else {
      consola.success(`Cached fix at ${result.genPath}`);
    }
  },
});
