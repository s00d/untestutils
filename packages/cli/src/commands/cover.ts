import { defineCommand, type CommandDef } from 'citty';
import { consola } from 'consola';
import { resolve } from 'pathe';
import { coverMissingTests } from '@untestutils/ai';

const coverArgs = {
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
  focus: {
    type: 'string',
    description: 'Comma-separated focus paths',
    default: '',
  },
  'base-url': {
    type: 'string',
    description: 'Live app URL for browser_snapshot tools',
  },
  browser: {
    type: 'boolean',
    description: 'Force browser tools',
    default: false,
  },
  'out-dir': {
    type: 'string',
    description: 'Directory for new tests',
    default: 'tests/e2e',
  },
  write: {
    type: 'boolean',
    description: 'Write files into the project',
    default: true,
  },
} as const;

export const coverCommand: CommandDef<typeof coverArgs> = defineCommand({
  meta: {
    name: 'cover',
    alias: ['write-tests'],
    description: 'Write missing e2e tests via AI (explores recipes/pages; optional browser)',
  },
  args: coverArgs,
  async run({ args }) {
    const recipes = String(args.recipes || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const focus = String(args.focus || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    consola.start('Covering missing tests with AI');
    const result = await coverMissingTests({
      root: resolve(String(args.root)),
      recipes,
      focus,
      baseURL: args['base-url'] ? String(args['base-url']) : undefined,
      browser: Boolean(args.browser || args['base-url']),
      outDir: String(args['out-dir']),
      write: Boolean(args.write),
    });

    for (const f of result.files) {
      consola.success(f.path);
    }
    consola.info(`fingerprint ${result.fingerprint.slice(0, 12)}…`);
  },
});
