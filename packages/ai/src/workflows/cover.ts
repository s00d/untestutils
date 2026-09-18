import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'pathe';
import { resolveArtifactsRoot, debug, envFlag, log } from '@untestutils/core';
import { extractLabeledTsFiles } from '../agent/types';
import { runAgentRaw } from '../agent/run';
import { loadCoverPrompt } from '../prompts';
import { createAgentToolkit } from '../tools/registry';
import { buildFileTree, fingerprint, listTestFiles, treeSignature } from '../tree';

export interface CoverTestsOptions {
  root: string;
  recipes?: string[];
  baseURL?: string;
  browser?: boolean;
  /** Directory to write new tests into */
  outDir?: string;
  focus?: string[];
  maxExploreSteps?: number;
  maxFilesRead?: number;
  maxBytesTotal?: number;
  write?: boolean;
}

export interface CoverResult {
  files: { path: string; code: string }[];
  fingerprint: string;
  readPaths: string[];
  genDir: string;
}

export async function coverMissingTests(opts: CoverTestsOptions): Promise<CoverResult> {
  const root = resolve(opts.root);
  const existing = await listTestFiles(root);
  const tree = await buildFileTree(root);
  const treeSig = treeSignature(tree);
  const id = `cover-${createHash('sha1')
    .update(root + existing.join(','))
    .digest('hex')
    .slice(0, 10)}`;
  const fp = fingerprint([
    'cover-v1',
    resolve(root),
    (opts.recipes ?? []).join(','),
    (opts.focus ?? []).join(','),
    existing.join('\n'),
    treeSig,
  ]);

  const artifactsRoot = resolveArtifactsRoot();
  const genDir = join(artifactsRoot, 'ai', id);
  await mkdir(genDir, { recursive: true });
  const metaPath = join(genDir, `${fp.slice(0, 8)}.meta.json`);

  if (existsSync(metaPath) && !opts.write) {
    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as CoverResult;
    debug('ai', `cover cache hit ${id}`);
    return meta;
  }

  if (!envFlag('UNTESTUTILS_AI', false) && process.env.UNTESTUTILS_AI_MOCK !== '1') {
    throw new Error(
      `[untestutils/ai] no cached cover for "${root}". Run with UNTESTUTILS_AI=1 (genDir would be ${genDir}).`,
    );
  }

  const toolkit = createAgentToolkit({
    root,
    maxFilesRead: opts.maxFilesRead ?? 40,
    maxBytesTotal: opts.maxBytesTotal ?? 400_000,
    browser: opts.browser || opts.baseURL ? { baseURL: opts.baseURL, headless: true } : false,
  });

  try {
    const system = await loadCoverPrompt();
    const raw = await runAgentRaw({
      system,
      mockKind: 'cover',
      mockRecipe: opts.recipes?.[0] ?? 'basic',
      maxSteps: opts.maxExploreSteps ?? 20,
      tools: toolkit.tools,
      prompt: [
        `Project root: ${root}`,
        `Recipes: ${(opts.recipes ?? []).join(', ') || '(none)'}`,
        `Focus: ${(opts.focus ?? []).join(', ') || '(none)'}`,
        opts.baseURL ? `Base URL: ${opts.baseURL}` : 'Base URL: (none)',
        `Existing test files:\n${existing.slice(0, 200).join('\n') || '(none)'}`,
        `File tree (truncated):\n${tree
          .slice(0, 500)
          .map((t) => t.path)
          .join('\n')}`,
        `Write missing high-value e2e tests. Prefer outDir ${opts.outDir ?? 'tests/e2e'}.`,
      ].join('\n\n'),
    });

    const blocks = extractLabeledTsFiles(raw);
    const outDir = resolve(root, opts.outDir ?? 'tests/e2e');
    const files: { path: string; code: string }[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!;
      const rel =
        b.path ||
        relative(
          root,
          join(
            outDir,
            blocks.length === 1 ? 'generated-cover.test.ts' : `generated-cover-${i + 1}.test.ts`,
          ),
        );
      const abs = resolve(root, rel);
      files.push({ path: abs, code: b.code });
      await mkdir(dirname(abs), { recursive: true });
      const cacheCopy = join(genDir, rel.replace(/[\\/]/g, '__'));
      await mkdir(dirname(cacheCopy), { recursive: true });
      await writeFile(cacheCopy, b.code, 'utf8');
      if (opts.write) {
        await writeFile(abs, b.code, 'utf8');
        log('ai', `cover wrote ${abs}`);
      }
    }

    const result: CoverResult = {
      files,
      fingerprint: fp,
      readPaths: toolkit.readPaths(),
      genDir,
    };
    await writeFile(metaPath, JSON.stringify(result, null, 2), 'utf8');
    return result;
  } finally {
    await toolkit.dispose?.();
  }
}
