import type { runLlmGenerate } from './agent/run';

type ModelInternals = {
  importAi: () => Promise<typeof import('ai')>;
  importAnthropic: () => Promise<typeof import('@ai-sdk/anthropic')>;
  importXai: () => Promise<typeof import('@ai-sdk/xai')>;
  importGoogle: () => Promise<typeof import('@ai-sdk/google')>;
  importOpenai: () => Promise<typeof import('@ai-sdk/openai')>;
  resolveModel: () => Promise<unknown>;
  runLlmGenerate: typeof runLlmGenerate;
};

/** @internal test seams for LLM path */
export const _internals: ModelInternals = {
  importAi: () => import('ai'),
  importAnthropic: () => import('@ai-sdk/anthropic'),
  importXai: () => import('@ai-sdk/xai'),
  importGoogle: () => import('@ai-sdk/google'),
  importOpenai: () => import('@ai-sdk/openai'),
  /** Bound after define — coverage tests spy imports then call via _internals */
  resolveModel: null as unknown as () => Promise<unknown>,
  runLlmGenerate: null as unknown as typeof runLlmGenerate,
};

export async function resolveModel(): Promise<unknown> {
  const provider = process.env.UNTESTUTILS_AI_PROVIDER || 'openai';
  if (provider === 'anthropic') {
    const { anthropic } = await _internals.importAnthropic();
    return anthropic(process.env.UNTESTUTILS_AI_MODEL || 'claude-sonnet-4-20250514');
  }
  if (provider === 'xai') {
    const { xai } = await _internals.importXai();
    return xai(process.env.UNTESTUTILS_AI_MODEL || 'grok-3');
  }
  if (provider === 'google') {
    const { google } = await _internals.importGoogle();
    return google(process.env.UNTESTUTILS_AI_MODEL || 'gemini-2.0-flash');
  }
  const { openai } = await _internals.importOpenai();
  return openai(process.env.UNTESTUTILS_AI_MODEL || 'gpt-4.1');
}

_internals.resolveModel = resolveModel;
