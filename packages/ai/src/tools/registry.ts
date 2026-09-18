import type { AgentTool, AgentToolBag } from '../agent/types';
import { createFsTools } from './fs';
import { createBrowserTools } from './browser';

export interface CreateAgentToolkitOptions {
  root: string;
  maxFilesRead?: number;
  maxBytesTotal?: number;
  /** Enable Playwright page tools */
  browser?: boolean | { baseURL?: string; headless?: boolean };
}

/**
 * Shared toolkit used by AI workflows (generate / convert / fix / cover).
 */
export function createAgentToolkit(opts: CreateAgentToolkitOptions): AgentToolBag {
  const fsBag = createFsTools(opts.root, {
    maxFilesRead: opts.maxFilesRead ?? 30,
    maxBytesTotal: opts.maxBytesTotal ?? 300_000,
  });
  const bags: AgentToolBag[] = [fsBag];

  if (opts.browser) {
    const browserOpts = typeof opts.browser === 'object' ? opts.browser : {};
    bags.push(createBrowserTools(browserOpts));
  }

  const tools: AgentTool[] = bags.flatMap((b) => b.tools);
  return {
    tools,
    readPaths: () => bags.flatMap((b) => b.readPaths()),
    dispose: async () => {
      for (const b of bags) await b.dispose?.();
    },
  };
}
