import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
  buildFileTree,
  createAiTools,
  fingerprint,
  treeSignature,
  aiTest,
} from '../../packages/ai/src/index';
import { resolveArtifactsRoot } from '../../packages/core/src/paths';

describe('ai context tools', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'untestutils-ai-'));
    await mkdir(join(root, 'pages'), { recursive: true });
    await writeFile(join(root, 'pages', 'index.vue'), '<template>Hi</template>');
    await writeFile(join(root, 'secret.env'), 'TOKEN=abc');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test('buildFileTree ignores noise patterns in listing depth', async () => {
    await mkdir(join(root, 'node_modules', 'x'), { recursive: true });
    await writeFile(join(root, 'node_modules', 'x', 'a.js'), '1');
    const tree = await buildFileTree(root);
    expect(tree.some((t) => t.path.startsWith('node_modules'))).toBe(false);
    expect(tree.some((t) => t.path.includes('index.vue'))).toBe(true);
  });

  test('read_file allowlist + deny env', async () => {
    const tools = createAiTools(root, { maxFilesRead: 5, maxBytesTotal: 10_000 });
    const body = await tools.read_file('pages/index.vue');
    expect(body).toContain('Hi');
    await expect(tools.read_file('.env')).rejects.toThrow();
  });

  test('fingerprint stable then changes with prompt', async () => {
    const tree = await buildFileTree(root);
    const sig = treeSignature(tree);
    const a = fingerprint({ prompt: 'login', root, recipes: ['b'], focus: [], treeSig: sig });
    const b = fingerprint({ prompt: 'login', root, recipes: ['b'], focus: [], treeSig: sig });
    const c = fingerprint({ prompt: 'logout', root, recipes: ['b'], focus: [], treeSig: sig });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test('aiTest mock generate + cache', async () => {
    process.env.UNTESTUTILS_AI = '1';
    process.env.UNTESTUTILS_AI_MOCK = '1';
    process.env.UNTESTUTILS_ARTIFACTS_DIR = await mkdtemp(join(tmpdir(), 'untestutils-ai-art-'));
    const r1 = await aiTest({
      id: 'demo',
      root,
      recipes: ['basic'],
      focus: ['pages/index.vue'],
      prompt: 'Check the home page',
    });
    expect(r1.code).toContain('ai-generated');
    const r2 = await aiTest({
      id: 'demo',
      root,
      recipes: ['basic'],
      focus: ['pages/index.vue'],
      prompt: 'Check the home page',
    });
    expect(r2.genPath).toBe(r1.genPath);
    expect(r2.readPaths).toEqual([]);
    await rm(process.env.UNTESTUTILS_ARTIFACTS_DIR, { recursive: true, force: true });
    delete process.env.UNTESTUTILS_AI;
    delete process.env.UNTESTUTILS_AI_MOCK;
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
  });
});
