import { envFlag } from '@untestutils/core';
import { _internals, resolveModel } from '../model';
import { extractTsFence, type AgentTool, type RunAgentOptions } from './types';

function buildAiTools(
  toolFactory: (def: {
    description: string;
    inputSchema: unknown;
    execute: (args: Record<string, unknown>) => Promise<unknown>;
  }) => unknown,
  tools: AgentTool[],
): Record<string, unknown> {
  const toolsObj: Record<string, unknown> = {};
  for (const t of tools) {
    toolsObj[t.name] = toolFactory({
      description: t.description,
      inputSchema: t.inputSchema as never,
      execute: async (args: Record<string, unknown>) => t.execute(args ?? {}),
    });
  }
  return toolsObj;
}

export async function runAgent(opts: RunAgentOptions): Promise<string> {
  if (process.env.UNTESTUTILS_AI_MOCK === '1') {
    const recipe = opts.mockRecipe ?? 'basic';
    const kind =
      opts.mockKind ??
      (/\bconvert\b/i.test(opts.system)
        ? 'convert'
        : /\bfix broken\b|\byou fix\b/i.test(opts.system)
          ? 'fix'
          : /\bmissing\b/i.test(opts.system)
            ? 'cover'
            : 'generate');
    if (kind === 'convert') {
      return `import { describe, test, expect, useHarness } from 'untestutils/vitest'\n\ndescribe('converted', () => {\n  test('placeholder from mock convert', async () => {\n    const app = await useHarness('${recipe}')\n    expect(app.url || app.dir).toBeTruthy()\n  })\n})\n`;
    }
    if (kind === 'fix') {
      return `import { describe, test, expect, useHarness } from 'untestutils/vitest'\n\ndescribe('fixed', () => {\n  test('placeholder from mock fix', async () => {\n    const app = await useHarness('${recipe}')\n    expect(app.url || app.dir).toBeTruthy()\n  })\n})\n`;
    }
    if (kind === 'cover') {
      return `import { describe, test, expect, useHarness } from 'untestutils/vitest'\n\ndescribe('coverage', () => {\n  test('placeholder from mock cover', async () => {\n    const app = await useHarness('${recipe}')\n    const html = await app.$fetch('/')\n    expect(html).toBeTruthy()\n  })\n})\n`;
    }
    const focus = opts.prompt.match(/Focus[^\n]*:\s*([^\n]+)/i);
    if (focus?.[1] && focus[1] !== '(none)') {
      const first = focus[1].split(',')[0]?.trim();
      if (first) {
        const read = opts.tools.find((t) => t.name === 'read_file');
        if (read) await read.execute({ path: first }).catch(() => '');
      }
    }
    return `import { describe, test, expect } from 'vitest'\nimport { useHarness } from 'untestutils'\n\ndescribe('ai-generated', () => {\n  test('placeholder from mock', async () => {\n    const app = await useHarness('${recipe}')\n    expect(app.url || app.dir).toBeTruthy()\n  })\n})\n`;
  }

  if (!envFlag('UNTESTUTILS_AI', false) && process.env.UNTESTUTILS_AI_MOCK !== '1') {
    // Callers that need cache-first should check before runAgent; allow explicit opt-in only
  }

  try {
    const ai = await _internals.importAi();
    const { generateText, tool } = ai;
    const stepCountIs = ai.stepCountIs as ((n: number) => unknown) | undefined;
    const model = await resolveModel();
    const maxSteps = opts.maxSteps ?? 16;

    const result = await generateText({
      model: model as never,
      system: opts.system,
      prompt: opts.prompt,
      tools: buildAiTools(tool as never, opts.tools) as never,
      ...(stepCountIs ? { stopWhen: stepCountIs(maxSteps) } : {}),
    } as never);

    return extractTsFence((result as { text: string }).text);
  } catch (e) {
    if (String(e).includes("Cannot find package 'ai'") || String(e).includes('MODULE_NOT_FOUND')) {
      throw new Error(
        `[untestutils/ai] install peer "ai" and a provider. Or set UNTESTUTILS_AI_MOCK=1. Cause: ${e}`,
      );
    }
    throw e;
  }
}

/** Like runAgent but returns raw model text (for multi-file cover). */
export async function runAgentRaw(opts: RunAgentOptions): Promise<string> {
  if (process.env.UNTESTUTILS_AI_MOCK === '1') {
    return `\`\`\`ts file:tests/e2e/generated-cover.test.ts\n${await runAgent({ ...opts, mockKind: opts.mockKind ?? 'cover' })}\n\`\`\``;
  }

  const ai = await _internals.importAi();
  const { generateText, tool } = ai;
  const stepCountIs = ai.stepCountIs as ((n: number) => unknown) | undefined;
  const model = await resolveModel();
  const maxSteps = opts.maxSteps ?? 20;

  const result = await generateText({
    model: model as never,
    system: opts.system,
    prompt: opts.prompt,
    tools: buildAiTools(tool as never, opts.tools) as never,
    ...(stepCountIs ? { stopWhen: stepCountIs(maxSteps) } : {}),
  } as never);

  return (result as { text: string }).text;
}

/** @internal back-compat for older coverage tests */
export async function runLlmGenerate(opts: {
  system: string;
  prompt: string;
  tree?: unknown[];
  focus?: string[];
  recipes?: string[];
  tools: {
    list_dir: (path?: string) => Promise<unknown>;
    read_file: (path: string) => Promise<unknown>;
    grep: (pattern: string, path?: string) => Promise<unknown>;
  };
  maxSteps?: number;
}): Promise<string> {
  const tools: AgentTool[] = [
    {
      name: 'list_dir',
      description: 'List directory under project root',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative directory' } },
      },
      execute: async (args) => opts.tools.list_dir(args.path ? String(args.path) : undefined),
    },
    {
      name: 'read_file',
      description: 'Read a file under project root',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative file path' } },
        required: ['path'],
      },
      execute: async (args) => opts.tools.read_file(String(args.path)),
    },
    {
      name: 'grep',
      description: 'Search files for a regex pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex' },
          path: { type: 'string', description: 'Relative start path' },
        },
        required: ['pattern'],
      },
      execute: async (args) =>
        opts.tools.grep(String(args.pattern), args.path ? String(args.path) : undefined),
    },
  ];

  return runAgent({
    system: opts.system,
    maxSteps: opts.maxSteps,
    tools,
    prompt: [
      opts.prompt,
      `Focus: ${(opts.focus ?? []).join(', ') || '(none)'}`,
      `Recipes: ${(opts.recipes ?? []).join(', ') || '(none)'}`,
    ].join('\n'),
  });
}
