export { buildFileTree, treeSignature, fingerprint, listTestFiles, IGNORE } from './tree';
export type { FileTreeEntry } from './tree';

export {
  loadPrompt,
  loadSystemPrompt,
  loadConvertPrompt,
  loadFixPrompt,
  loadCoverPrompt,
  aiFs,
} from './prompts';
export type { PromptName } from './prompts';

export { resolveModel, _internals } from './model';

export { createFsTools, createAiTools } from './tools/fs';
export { createBrowserTools } from './tools/browser';
export { createAgentToolkit } from './tools/registry';
export type { CreateAgentToolkitOptions } from './tools/registry';

export { runAgent, runAgentRaw, runLlmGenerate } from './agent/run';
export { extractTsFence, extractLabeledTsFiles } from './agent/types';
export type { AgentTool, AgentToolBag, RunAgentOptions } from './agent/types';

import { runLlmGenerate } from './agent/run';
import { _internals } from './model';
_internals.runLlmGenerate = runLlmGenerate;

export {
  aiTest,
  aiTestFromFile,
  convertTestFile,
  AI_PROMPT_VERSION,
  CONVERT_PROMPT_VERSION,
} from './workflows/generate';
export type { AiTestOptions, ConvertTestOptions } from './workflows/generate';
export type { GenerateResult } from './workflows/types';

export { fixBrokenTests } from './workflows/fix';
export type { FixTestsOptions } from './workflows/fix';

export { coverMissingTests } from './workflows/cover';
export type { CoverTestsOptions, CoverResult } from './workflows/cover';
