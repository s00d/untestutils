import { defineCommand } from 'citty';
import { consola } from 'consola';
import { resolve, dirname, basename, join } from 'pathe';
import { convertTestFile } from '@untestutils/ai';
import { writeText, pathExists } from '../utils/fs';
import { copyFile } from 'node:fs/promises';

export const convertCommand = defineCommand({
  meta: {
    name: 'convert',
    description: 'Convert existing tests to the untestutils API via AI',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Test file path',
      required: true,
    },
    'in-place': {
      type: 'boolean',
      description: 'Overwrite source (writes .bak backup)',
      default: false,
      alias: 'i',
    },
    root: {
      type: 'string',
      description: 'Project root for AI tools',
      default: '.',
    },
  },
  async run({ args }) {
    const file = resolve(String(args.path));
    if (!(await pathExists(file))) {
      consola.error(`File not found: ${file}`);
      process.exitCode = 1;
      return;
    }

    consola.start(`Converting ${file}`);
    const result = await convertTestFile({
      path: file,
      root: resolve(String(args.root)),
    });

    if (args['in-place']) {
      const bak = `${file}.bak`;
      await copyFile(file, bak);
      await writeText(file, result.code);
      consola.success(`Overwrote ${file} (backup: ${bak})`);
    } else {
      const dir = dirname(file);
      const base = basename(file).replace(/(\.test|\.spec)?(\.[cm]?[jt]sx?)$/, '');
      const out = join(dir, `${base}.untestutils.test.ts`);
      await writeText(out, result.code);
      consola.success(`Wrote ${out}`);
    }
  },
});
