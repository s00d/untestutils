import { defineCommand } from 'citty';
import { commands } from './commands';

export const main = defineCommand({
  meta: {
    name: 'untestutils',
    version: '0.1.0',
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
});
