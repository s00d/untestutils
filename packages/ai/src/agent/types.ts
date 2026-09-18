export interface ToolParameter {
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: ToolParameter;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentToolBag {
  tools: AgentTool[];
  readPaths: () => string[];
  dispose?: () => Promise<void>;
}

export interface RunAgentOptions {
  system: string;
  prompt: string;
  tools: AgentTool[];
  maxSteps?: number;
  /** Mock mode key for deterministic fixtures */
  mockKind?: 'generate' | 'convert' | 'fix' | 'cover';
  mockRecipe?: string;
}

export function extractTsFence(text: string): string {
  const match = text.match(/```ts\n([\s\S]*?)```/) || text.match(/```typescript\n([\s\S]*?)```/);
  if (!match) throw new Error('[untestutils/ai] model did not return a ts fence');
  return match[1]!;
}

export function extractLabeledTsFiles(text: string): { path?: string; code: string }[] {
  const blocks: { path?: string; code: string }[] = [];
  const re = /```(?:ts|typescript)(?:\s+([^\n]+))?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const label = m[1]?.trim();
    const path = label?.startsWith('file:') ? label.slice(5).trim() : label;
    blocks.push({ path: path || undefined, code: m[2]! });
  }
  if (blocks.length === 0) {
    blocks.push({ code: extractTsFence(text) });
  }
  return blocks;
}
