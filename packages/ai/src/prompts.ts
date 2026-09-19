import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

/** @internal */
export const aiFs: {
  existsSync: typeof existsSync;
  readFile: typeof readFile;
} = {
  existsSync,
  readFile,
};

export type PromptName = 'v1' | 'convert-v1' | 'fix-v1' | 'cover-v1';

const DEFAULTS: Record<PromptName, string> = {
  v1: `English untestutils tests. Tools first. useHarness+$fetch or page/goto; playwright test.use({harness}). One ts fence.`,
  'convert-v1': `Convert to untestutils (useHarness / untestutils/vitest|playwright). Keep intent. English. One ts fence.`,
  'fix-v1': `Fix broken untestutils test. Keep intent; no sleep/skip. Real selectors/recipe. English. One ts fence.`,
  'cover-v1': `Missing high-value e2e only. Inventory+snapshot. English. ts fence or ts file:path.`,
};

export async function loadPrompt(name: PromptName): Promise<string> {
  const file = `${name}.md`;
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), 'prompts', file),
    resolve(process.cwd(), 'src/ai/prompts', file),
    resolve(process.cwd(), 'packages/ai/src/prompts', file),
  ];
  for (const c of candidates) {
    if (aiFs.existsSync(c)) return aiFs.readFile(c, 'utf8');
  }
  return DEFAULTS[name];
}

export const loadSystemPrompt = (): Promise<string> => loadPrompt('v1');
export const loadConvertPrompt = (): Promise<string> => loadPrompt('convert-v1');
export const loadFixPrompt = (): Promise<string> => loadPrompt('fix-v1');
export const loadCoverPrompt = (): Promise<string> => loadPrompt('cover-v1');
