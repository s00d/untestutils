import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import { atomicWriteJson } from './lock';
import { normalizeBaseUrl } from './paths';
import { debug } from './debug';

export interface TargetEntry {
  id: string;
  url?: string;
  dir?: string;
  identity: string;
}

export type TargetMap = Record<string, TargetEntry>;

export class TargetRegistry {
  constructor(private readonly artifactsRoot: string) {}

  get filePath(): string {
    return join(this.artifactsRoot, 'targets.json');
  }

  async read(): Promise<TargetMap> {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8')) as TargetMap;
    } catch {
      return {};
    }
  }

  async write(map: TargetMap): Promise<void> {
    await atomicWriteJson(this.filePath, map);
    debug('registry', `wrote ${Object.keys(map).length} targets`);
  }

  async set(entry: TargetEntry): Promise<void> {
    const map = await this.read();
    const normalized: TargetEntry = {
      ...entry,
      url: entry.url ? normalizeBaseUrl(entry.url) : undefined,
    };
    map[entry.id] = normalized;
    await this.write(map);
    this.applyEnv(normalized);
  }

  async get(id: string): Promise<TargetEntry | undefined> {
    const fromEnv = process.env[envKey(id)];
    if (fromEnv) {
      return { id, url: normalizeBaseUrl(fromEnv), identity: id };
    }
    const map = await this.read();
    return map[id];
  }

  applyAllToEnv(map: TargetMap): void {
    for (const entry of Object.values(map)) this.applyEnv(entry);
  }

  applyEnv(entry: TargetEntry): void {
    if (entry.url) process.env[envKey(entry.id)] = entry.url;
    if (entry.dir) process.env[envDirKey(entry.id)] = entry.dir;
  }

  async clear(): Promise<void> {
    await atomicWriteJson(this.filePath, {});
  }
}

export function envKey(id: string): string {
  return `UNTESTUTILS_HOST_${sanitizeId(id)}`;
}

export function envDirKey(id: string): string {
  return `UNTESTUTILS_DIR_${sanitizeId(id)}`;
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
}
