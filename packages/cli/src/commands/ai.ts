import { defineCommand, type CommandDef } from 'citty';
import { consola } from 'consola';
import { resolve } from 'pathe';
import { aiTest, aiTestFromFile } from '@untestutils/ai';
import { writeText } from '../utils/fs';

const aiArgs = {
  prompt: {
    type: 'string',
    description: 'Scenario text',
    alias: 'p',
  },
  file: {
    type: 'string',
    description: 'Markdown with frontmatter (id/root/recipes/focus)',
    alias: 'f',
  },
  id: {
    type: 'string',
    description: 'Generation id',
    default: 'cli',
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
  focus: {
    type: 'string',
    description: 'Comma-separated focus file hints',
    default: '',
  },
  out: {
    type: 'string',
    description: 'Copy generated file to this path',
  },
} as const;

export const aiCommand: CommandDef<typeof aiArgs> = defineCommand({
  meta: {
    name: 'ai',
    alias: ['generate'],
    description: 'Generate an e2e test from a prompt or markdown file',
  },
  args: aiArgs,
  async run({ args }) {
    const root = resolve(String(args.root));
    const recipes = String(args.recipes || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const focus = String(args.focus || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let result;
    if (args.file) {
      consola.start(`AI from file ${args.file}`);
      result = await aiTestFromFile(resolve(String(args.file)), {
        id: String(args.id),
        root,
        recipes,
        focus,
      });
    } else if (args.prompt) {
      consola.start('AI generation from prompt');
      result = await aiTest({
        id: String(args.id),
        prompt: String(args.prompt),
        root,
        recipes,
        focus,
      });
    } else {
      consola.error('Provide --prompt or --file');
      process.exitCode = 1;
      return;
    }

    consola.success(`Generated: ${result.genPath}`);
    if (args.out) {
      await writeText(resolve(String(args.out)), result.code);
      consola.success(`Copied to ${args.out}`);
    }
  },
});
