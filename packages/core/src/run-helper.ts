import type { RunHelper } from './types';
import { runCommand, scrubTestEnv, spawnManaged } from './process';

function interpolate(strings: TemplateStringsArray, values: unknown[]): string {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += String(values[i]);
  }
  return out.trim();
}

function splitCommand(cmd: string): { command: string; args: string[] } {
  // simple split — enough for recipes; complex shells should use run.command
  const parts = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const cleaned = parts.map((p) => p.replace(/^['"]|['"]$/g, ''));
  const [command, ...args] = cleaned;
  if (!command) throw new Error('[untestutils] empty command');
  return { command, args };
}

export function createRunHelper(
  defaults: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): RunHelper {
  const run = (async (strings, ...values) => {
    const cmd = interpolate(strings, values);
    const { command, args } = splitCommand(cmd);
    return runCommand(command, args, {
      cwd: defaults.cwd,
      env: { ...scrubTestEnv(), ...defaults.env },
    });
  }) as RunHelper;

  run.command = async (cmd, opts = {}) => {
    const { command, args } = splitCommand(cmd);
    return runCommand(command, args, {
      cwd: opts.cwd ?? defaults.cwd,
      env: { ...scrubTestEnv(), ...defaults.env, ...opts.env },
    });
  };

  run.detached = async (strings, ...values) => {
    const cmd = interpolate(strings, values);
    const { command, args } = splitCommand(cmd);
    return spawnManaged(command, args, {
      cwd: defaults.cwd,
      env: { ...scrubTestEnv(), ...defaults.env },
      captureLogs: true,
      server: true,
    });
  };

  return run;
}
