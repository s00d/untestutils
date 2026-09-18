import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
  AI_PROMPT_VERSION,
  buildFileTree,
  createAiTools,
  loadSystemPrompt,
  aiTest,
  aiTestFromFile,
  fingerprint,
  treeSignature,
} from '@untestutils/ai';

describe('ai remaining branches', () => {
  let root: string;
  let artifacts: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ut-ai-'));
    artifacts = await mkdtemp(join(tmpdir(), 'ut-ai-art-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'a.ts'), 'export const a = 1');
    process.env.UNTESTUTILS_ARTIFACTS_DIR = artifacts;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    delete process.env.UNTESTUTILS_AI;
    delete process.env.UNTESTUTILS_AI_MOCK;
  });

  test('tools list_dir grep escape limits redact', async () => {
    const tools = createAiTools(root, { maxFilesRead: 1, maxBytesTotal: 50 });
    const list = await tools.list_dir('src');
    expect(list.some((e) => e.name === 'a.ts')).toBe(true);
    expect(await tools.grep('export', 'src')).toBeTruthy();
    await expect(tools.read_file('../outside')).rejects.toThrow(/escapes/);
    await tools.read_file('src/a.ts');
    await expect(tools.read_file('src/a.ts')).rejects.toThrow(/maxFilesRead/);
    const tools2 = createAiTools(root, { maxFilesRead: 5, maxBytesTotal: 5 });
    await expect(tools2.read_file('src/a.ts')).rejects.toThrow(/maxBytes/);
    await writeFile(join(root, 'token.txt'), 'api_key = "sk-abc"');
    const tools3 = createAiTools(root, { maxFilesRead: 5, maxBytesTotal: 10_000 });
    const redacted = await tools3.read_file('token.txt');
    expect(redacted).toContain('***');
    expect(AI_PROMPT_VERSION).toBe('v1');
    expect(await loadSystemPrompt()).toContain('English');
  });

  test('aiTest requires AI flag without cache', async () => {
    delete process.env.UNTESTUTILS_AI;
    await expect(aiTest({ id: 'x', root, prompt: 'test', recipes: ['a'] })).rejects.toThrow(
      /UNTESTUTILS_AI/,
    );
  });

  test('aiTestFromFile frontmatter', async () => {
    process.env.UNTESTUTILS_AI = '1';
    process.env.UNTESTUTILS_AI_MOCK = '1';
    const file = join(root, 'case.ai.md');
    await writeFile(
      file,
      `---
id: from-file
recipes: basic
root: .
---
Check the page
`,
    );
    const r = await aiTestFromFile(file, { root });
    expect(r.code).toContain('ai-generated');
  });

  test('fingerprint uses tree', async () => {
    const tree = await buildFileTree(root);
    expect(
      fingerprint({
        prompt: 'p',
        root,
        recipes: [],
        focus: ['src/a.ts'],
        treeSig: treeSignature(tree),
      }),
    ).toHaveLength(40);
  });
});
