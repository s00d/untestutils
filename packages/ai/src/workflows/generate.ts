import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'pathe';
import { resolveArtifactsRoot, debug, envFlag, log } from '@untestutils/core';
import { runAgent } from '../agent/run';
import { loadConvertPrompt, loadSystemPrompt } from '../prompts';
import { createAgentToolkit } from '../tools/registry';
import { buildFileTree, fingerprint, treeSignature, type FileTreeEntry } from '../tree';
import type { GenerateResult } from './types';

export const AI_PROMPT_VERSION = 'v1';
export const CONVERT_PROMPT_VERSION = 'convert-v1';

export interface AiTestOptions {
  id: string;
  prompt: string;
  root: string;
  recipes?: string[];
  focus?: string[];
  maxAttempts?: number;
  maxExploreSteps?: number;
  maxFilesRead?: number;
  maxBytesTotal?: number;
  baseURL?: string;
  browser?: boolean;
}

function genFingerprint(opts: {
  prompt: string;
  root: string;
  recipes: string[];
  focus: string[];
  treeSig: string;
  version?: string;
}): string {
  return fingerprint([
    opts.version ?? AI_PROMPT_VERSION,
    opts.prompt.trim(),
    resolve(opts.root),
    opts.recipes.join(','),
    opts.focus.join(','),
    opts.treeSig,
  ]);
}

export async function aiTest(opts: AiTestOptions): Promise<GenerateResult> {
  const root = resolve(opts.root);
  const tree = await buildFileTree(root);
  const treeSig = treeSignature(tree);
  const fp = genFingerprint({
    prompt: opts.prompt,
    root,
    recipes: opts.recipes ?? [],
    focus: opts.focus ?? [],
    treeSig,
  });

  const artifactsRoot = resolveArtifactsRoot();
  const genDir = join(artifactsRoot, 'ai');
  await mkdir(genDir, { recursive: true });
  const genPath = join(genDir, `${opts.id}.${fp.slice(0, 8)}.spec.gen.ts`);

  if (existsSync(genPath)) {
    const code = await readFile(genPath, 'utf8');
    debug('ai', `cache hit ${opts.id}`);
    return { code, genPath, fingerprint: fp, readPaths: [] };
  }

  if (!envFlag('UNTESTUTILS_AI', false) && process.env.UNTESTUTILS_AI_MOCK !== '1') {
    throw new Error(
      `[untestutils/ai] no cached test for "${opts.id}". Run locally with UNTESTUTILS_AI=1 once (genPath would be ${genPath}).`,
    );
  }

  const toolkit = createAgentToolkit({
    root,
    maxFilesRead: opts.maxFilesRead ?? 20,
    maxBytesTotal: opts.maxBytesTotal ?? 200_000,
    browser: opts.browser || opts.baseURL ? { baseURL: opts.baseURL } : false,
  });

  try {
    const system = await loadSystemPrompt();
    const treeText = tree
      .slice(0, 500)
      .map((t) => `${t.path} (${t.size})`)
      .join('\n');
    const code = await runAgent({
      system,
      mockKind: 'generate',
      mockRecipe: opts.recipes?.[0] ?? 'basic',
      maxSteps: opts.maxExploreSteps ?? 12,
      tools: toolkit.tools,
      prompt: [
        `Recipes: ${(opts.recipes ?? []).join(', ') || '(none)'}`,
        `Focus hints: ${(opts.focus ?? []).join(', ') || '(none)'}`,
        opts.baseURL ? `Base URL: ${opts.baseURL}` : '',
        `File tree under root:\n${treeText}`,
        `User scenario:\n${opts.prompt}`,
        `Use tools to read files you need, then output a single English ts-fenced test file.`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    });

    await writeFile(genPath, code, 'utf8');
    log('ai', `wrote ${genPath}`);
    return { code, genPath, fingerprint: fp, readPaths: toolkit.readPaths() };
  } finally {
    await toolkit.dispose?.();
  }
}

export interface ConvertTestOptions {
  path: string;
  root: string;
  maxFilesRead?: number;
  maxBytesTotal?: number;
  maxExploreSteps?: number;
}

export async function convertTestFile(opts: ConvertTestOptions): Promise<GenerateResult> {
  const root = resolve(opts.root);
  const filePath = resolve(opts.path);
  const source = await readFile(filePath, 'utf8');
  const tree = await buildFileTree(root);
  const treeSig = treeSignature(tree);
  const id = `convert-${createHash('sha1').update(filePath).digest('hex').slice(0, 8)}`;
  const fp = genFingerprint({
    prompt: `${CONVERT_PROMPT_VERSION}\n${source}`,
    root,
    recipes: [],
    focus: [relative(root, filePath)],
    treeSig,
    version: CONVERT_PROMPT_VERSION,
  });

  const artifactsRoot = resolveArtifactsRoot();
  const genDir = join(artifactsRoot, 'ai');
  await mkdir(genDir, { recursive: true });
  const genPath = join(genDir, `${id}.${fp.slice(0, 8)}.spec.gen.ts`);

  if (existsSync(genPath)) {
    const code = await readFile(genPath, 'utf8');
    debug('ai', `convert cache hit ${id}`);
    return { code, genPath, fingerprint: fp, readPaths: [] };
  }

  if (!envFlag('UNTESTUTILS_AI', false) && process.env.UNTESTUTILS_AI_MOCK !== '1') {
    throw new Error(
      `[untestutils/ai] no cached convert for "${filePath}". Run with UNTESTUTILS_AI=1 once (genPath would be ${genPath}).`,
    );
  }

  const toolkit = createAgentToolkit({
    root,
    maxFilesRead: opts.maxFilesRead ?? 20,
    maxBytesTotal: opts.maxBytesTotal ?? 200_000,
  });

  try {
    const system = await loadConvertPrompt();
    const code = await runAgent({
      system,
      mockKind: 'convert',
      maxSteps: opts.maxExploreSteps ?? 8,
      tools: toolkit.tools,
      prompt: [
        `Convert this test file to untestutils.`,
        `Source path: ${relative(root, filePath)}`,
        `Source:\n\`\`\`ts\n${source}\n\`\`\``,
      ].join('\n\n'),
    });

    await writeFile(genPath, code, 'utf8');
    log('ai', `convert wrote ${genPath}`);
    return { code, genPath, fingerprint: fp, readPaths: toolkit.readPaths() };
  } finally {
    await toolkit.dispose?.();
  }
}

export async function aiTestFromFile(path: string, defaults: Partial<AiTestOptions> = {}) {
  const raw = await readFile(path, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta: Record<string, unknown> = {};
  let prompt = raw;
  if (fm) {
    prompt = fm[2]!.trim();
    for (const line of fm[1]!.split('\n')) {
      const [k, ...rest] = line.split(':');
      if (k)
        meta[k.trim()] = rest
          .join(':')
          .trim()
          .replace(/^['"]|['"]$/g, '');
    }
  }
  return aiTest({
    id: String(meta.id ?? defaults.id ?? 'from-file'),
    root: String(meta.root ?? defaults.root ?? '.'),
    recipes: meta.recipes
      ? String(meta.recipes)
          .split(',')
          .map((s) => s.trim())
      : defaults.recipes,
    focus: meta.focus
      ? String(meta.focus)
          .split(',')
          .map((s) => s.trim())
      : defaults.focus,
    prompt,
  });
}

export type { FileTreeEntry };
