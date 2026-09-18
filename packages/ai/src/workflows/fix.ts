import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'pathe';
import { resolveArtifactsRoot, debug, envFlag, log } from '@untestutils/core';
import { runAgent } from '../agent/run';
import { loadFixPrompt } from '../prompts';
import { createAgentToolkit } from '../tools/registry';
import { buildFileTree, fingerprint, treeSignature } from '../tree';
import type { GenerateResult } from '../workflows/types';

export interface FixTestsOptions {
  /** Failing test file */
  path: string;
  root: string;
  /** Vitest/Playwright failure log */
  failureLog: string;
  recipes?: string[];
  baseURL?: string;
  browser?: boolean;
  maxExploreSteps?: number;
  maxFilesRead?: number;
  maxBytesTotal?: number;
  /** Write fixed content back to path */
  write?: boolean;
}

export async function fixBrokenTests(opts: FixTestsOptions): Promise<GenerateResult> {
  const root = resolve(opts.root);
  const filePath = resolve(opts.path);
  const source = await readFile(filePath, 'utf8');
  const tree = await buildFileTree(root);
  const treeSig = treeSignature(tree);
  const id = `fix-${createHash('sha1')
    .update(filePath + opts.failureLog)
    .digest('hex')
    .slice(0, 10)}`;
  const fp = fingerprint([
    'fix-v1',
    source,
    opts.failureLog.slice(0, 4000),
    resolve(root),
    (opts.recipes ?? []).join(','),
    treeSig,
  ]);

  const artifactsRoot = resolveArtifactsRoot();
  const genDir = join(artifactsRoot, 'ai');
  await mkdir(genDir, { recursive: true });
  const genPath = join(genDir, `${id}.${fp.slice(0, 8)}.fixed.gen.ts`);

  if (existsSync(genPath) && !opts.write) {
    const code = await readFile(genPath, 'utf8');
    debug('ai', `fix cache hit ${id}`);
    return { code, genPath, fingerprint: fp, readPaths: [] };
  }

  if (!envFlag('UNTESTUTILS_AI', false) && process.env.UNTESTUTILS_AI_MOCK !== '1') {
    throw new Error(
      `[untestutils/ai] no cached fix for "${filePath}". Run with UNTESTUTILS_AI=1 (genPath would be ${genPath}).`,
    );
  }

  const toolkit = createAgentToolkit({
    root,
    maxFilesRead: opts.maxFilesRead ?? 30,
    maxBytesTotal: opts.maxBytesTotal ?? 300_000,
    browser: opts.browser
      ? { baseURL: opts.baseURL, headless: true }
      : opts.baseURL
        ? { baseURL: opts.baseURL, headless: true }
        : false,
  });

  try {
    const system = await loadFixPrompt();
    const code = await runAgent({
      system,
      mockKind: 'fix',
      mockRecipe: opts.recipes?.[0] ?? 'basic',
      maxSteps: opts.maxExploreSteps ?? 16,
      tools: toolkit.tools,
      prompt: [
        `Failing file: ${relative(root, filePath)}`,
        `Recipes: ${(opts.recipes ?? []).join(', ') || '(none)'}`,
        opts.baseURL ? `Base URL: ${opts.baseURL}` : 'Base URL: (none — use filesystem tools)',
        `Failure log:\n\`\`\`\n${opts.failureLog.slice(0, 12_000)}\n\`\`\``,
        `Current source:\n\`\`\`ts\n${source}\n\`\`\``,
        `File tree (truncated):\n${tree
          .slice(0, 400)
          .map((t) => t.path)
          .join('\n')}`,
        `Fix the test file. Explore the app if browser tools are available.`,
      ].join('\n\n'),
    });

    await writeFile(genPath, code, 'utf8');
    if (opts.write) {
      await writeFile(filePath, code, 'utf8');
      log('ai', `fix wrote ${filePath}`);
    } else {
      log('ai', `fix cached ${genPath}`);
    }
    return { code, genPath, fingerprint: fp, readPaths: toolkit.readPaths() };
  } finally {
    await toolkit.dispose?.();
  }
}
