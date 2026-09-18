import { spawn } from 'node:child_process';
import type { DetachedProcess, RunHelper, RunResult } from './types';
import { killProcessTree, runCommand, scrubTestEnv } from './process';
import { platform } from 'node:os';

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
    const result = await runCommand(command, args, {
      cwd: defaults.cwd,
      env: { ...scrubTestEnv(), ...defaults.env },
    });
    return result;
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
    const env = { ...scrubTestEnv(), ...defaults.env };
    let output = '';
    const child = spawn(command, args, {
      cwd: defaults.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: platform() !== 'win32',
    });
    child.stdout?.on('data', (c: Buffer) => {
      output += c.toString();
    });
    child.stderr?.on('data', (c: Buffer) => {
      output += c.toString();
    });
    const proc: DetachedProcess = {
      pid: child.pid,
      stop: async () => killProcessTree(child),
      logs: () => output,
    };
    return proc;
  };

  return run;
}

export type { RunResult };
