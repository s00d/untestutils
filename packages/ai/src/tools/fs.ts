import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'pathe';
import { IGNORE } from '../tree';
import type { AgentTool, AgentToolBag } from '../agent/types';

type DirectoryEntry = { name: string; type: 'dir' | 'file' };
type GrepHit = { file: string; line: number; text: string };

export type AiTools = {
  readPaths: () => string[];
  list_dir: (path?: string) => Promise<unknown>;
  read_file: (path: string) => Promise<unknown>;
  grep: (pattern: string, path?: string) => Promise<unknown>;
};

function redact(content: string): string {
  return content
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*['"][^'"]+['"]/gi, '$1: "***"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***');
}

export function createFsTools(
  root: string,
  limits: { maxFilesRead: number; maxBytesTotal: number },
): AgentToolBag {
  const absRoot = resolve(root);
  let filesRead = 0;
  let bytes = 0;
  const readPaths: string[] = [];

  function assertInside(rel: string): string {
    const full = resolve(absRoot, rel);
    if (!full.startsWith(absRoot + sep) && full !== absRoot) {
      throw new Error(`path escapes root: ${rel}`);
    }
    return full;
  }

  const list_dir = async (path = '.'): Promise<DirectoryEntry[]> => {
    const full = assertInside(path);
    const entries = await readdir(full, { withFileTypes: true });
    return entries
      .filter((e) => !IGNORE.has(e.name))
      .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
  };

  const read_file = async (path: string): Promise<string> => {
    if (filesRead >= limits.maxFilesRead) throw new Error('maxFilesRead exceeded');
    const full = assertInside(path);
    if (full.includes(`${sep}.env`) || /secret|credential/i.test(full)) {
      throw new Error('denied path');
    }
    const content = await readFile(full, 'utf8');
    if (bytes + content.length > limits.maxBytesTotal) throw new Error('maxBytesTotal exceeded');
    filesRead++;
    bytes += content.length;
    readPaths.push(path);
    return redact(content);
  };

  const grep = async (pattern: string, path = '.'): Promise<GrepHit[]> => {
    const full = assertInside(path);
    const re = new RegExp(pattern);
    const hits: GrepHit[] = [];
    async function walk(dir: string): Promise<void> {
      if (hits.length >= 50) return;
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const e of entries) {
        if (IGNORE.has(e.name)) continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.isFile()) {
          const text = await readFile(p, 'utf8').catch(() => '');
          const lines = text.split('\n');
          lines.forEach((line, i) => {
            if (hits.length < 50 && re.test(line)) {
              hits.push({ file: relative(absRoot, p), line: i + 1, text: line.slice(0, 200) });
            }
          });
        }
      }
    }
    await walk(full);
    return hits;
  };

  return {
    readPaths: () => readPaths,
    tools: [
      {
        name: 'list_dir',
        description: 'List directory under project root',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Relative directory' } },
        },
        execute: async (args) => list_dir(String(args.path ?? '.')),
      },
      {
        name: 'read_file',
        description: 'Read a file under project root',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Relative file path' } },
          required: ['path'],
        },
        execute: async (args) => read_file(String(args.path)),
      },
      {
        name: 'grep',
        description: 'Search files for a regex pattern',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Regex' },
            path: { type: 'string', description: 'Relative start path' },
          },
          required: ['pattern'],
        },
        execute: async (args) => grep(String(args.pattern), args.path ? String(args.path) : '.'),
      },
    ],
  };
}

/** Back-compat wrapper used by older call sites */
export function createAiTools(
  root: string,
  limits: { maxFilesRead: number; maxBytesTotal: number },
): AiTools {
  const bag = createFsTools(root, limits);
  const byName: Record<string, AgentTool | undefined> = Object.fromEntries(
    bag.tools.map((t) => [t.name, t]),
  );
  return {
    readPaths: bag.readPaths,
    list_dir: (path?: string) => byName.list_dir!.execute({ path }),
    read_file: (path: string) => byName.read_file!.execute({ path }),
    grep: (pattern: string, path?: string) => byName.grep!.execute({ pattern, path }),
  };
}
