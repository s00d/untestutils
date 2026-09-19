import { defineCommand, type CommandDef } from 'citty';
import { consola } from 'consola';
import { addDependency } from 'nypm';
import { resolve } from 'pathe';
import { applyPreset, peersForPreset, type InitPreset } from '../utils/templates';

const PRESETS: InitPreset[] = ['vitest', 'playwright', 'nuxt', 'full'];

const initArgs = {
  preset: {
    type: 'string',
    description: 'Preset: vitest | playwright | nuxt | full',
    default: 'vitest',
    alias: 'p',
  },
  cwd: {
    type: 'string',
    description: 'Project directory',
    default: '.',
  },
  force: {
    type: 'boolean',
    description: 'Overwrite existing files',
    default: false,
  },
  install: {
    type: 'boolean',
    description: 'Install peer dependencies via nypm',
    default: true,
  },
} as const;

export const initCommand: CommandDef<typeof initArgs> = defineCommand({
  meta: {
    name: 'init',
    description: 'Add base untestutils configs and example tests to a project',
  },
  args: initArgs,
  async run({ args }) {
    const preset = String(args.preset) as InitPreset;
    if (!PRESETS.includes(preset)) {
      consola.error(`Unknown preset "${preset}". Available: ${PRESETS.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    const cwd = resolve(String(args.cwd));
    consola.start(`Initializing untestutils (preset=${preset}) in ${cwd}`);
    const written = await applyPreset(cwd, preset, { force: Boolean(args.force) });
    if (written.length === 0) {
      consola.info('No new files — already present (or use --force)');
    } else {
      consola.success(`Created files: ${written.length}`);
    }

    if (args.install) {
      const deps = peersForPreset(preset);
      consola.start(`Installing dependencies: ${deps.join(', ')}`);
      try {
        // Fresh projects often have no lockfile — nypm cannot auto-detect. Prefer
        // detected PM, else pnpm (matches engines/docs), always as -D.
        const { detectPackageManager } = await import('nypm');
        const detected = await detectPackageManager(cwd, { includeParentDirs: false });
        await addDependency(deps, {
          cwd,
          silent: false,
          packageManager: detected?.name ?? 'pnpm',
          dev: true,
        });
        consola.success('Dependencies installed');
      } catch (e) {
        consola.warn(`Could not install automatically: ${e}`);
        consola.info(`Install manually: ${deps.join(' ')}`);
      }
    }

    consola.box(
      [
        'Next steps:',
        '  1. Review recipes.ts and fixture app paths',
        '  2. pnpm test / npx vitest run',
        '  3. untestutils doctor — environment check',
      ].join('\n'),
    );
  },
});
