import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import { atomicWriteJson, FileLock } from './lock';
import { normalizeBaseUrl } from './paths';
import { debug } from './debug';

export interface TargetEntry {
  id: string;
  url?: string;
  dir?: string;
  identity: string;
  /** Managed server pid — written by the starter worker so global teardown can kill orphans. */
  pid?: number;
}

export type TargetMap = Record<string, TargetEntry>;

export class TargetRegistry {
  constructor(private readonly artifactsRoot: string) {}

  get filePath(): string {
    return join(this.artifactsRoot, 'targets.json');
  }

  private lockPath(): string {
    return join(this.artifactsRoot, 'locks', 'targets.lock');
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lock = new FileLock(this.lockPath(), 'targets');
    await lock.acquire();
    try {
      return await fn();
    } finally {
      await lock.release();
    }
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

  async set(entry: TargetEntry): Promise<TargetEntry | undefined> {
    let previous: TargetEntry | undefined;
    await this.withLock(async () => {
      const map = await this.read();
      previous = map[entry.id];
      const normalized: TargetEntry = {
        ...entry,
        url: entry.url ? normalizeBaseUrl(entry.url) : undefined,
      };
      map[entry.id] = normalized;
      await this.write(map);
      this.applyEnv(normalized);
    });
    return previous;
  }

  async get(id: string): Promise<TargetEntry | undefined> {
    const map = await this.read();
    const fromFile = map[id];
    const fromEnv = process.env[envKey(id)];
    if (fromFile) {
      return {
        ...fromFile,
        // Worker env may carry the URL before the next read; keep file pid/dir.
        url: fromEnv ? normalizeBaseUrl(fromEnv) : fromFile.url,
      };
    }
    if (fromEnv) {
      return { id, url: normalizeBaseUrl(fromEnv), identity: id };
    }
    return undefined;
  }

  applyAllToEnv(map: TargetMap): void {
    for (const entry of Object.values(map)) this.applyEnv(entry);
  }

  applyEnv(entry: TargetEntry): void {
    if (entry.url) process.env[envKey(entry.id)] = entry.url;
    if (entry.dir) process.env[envDirKey(entry.id)] = entry.dir;
  }

  async clear(): Promise<void> {
    await this.withLock(async () => {
      await atomicWriteJson(this.filePath, {});
    });
  }

  /** Atomically read + clear — used by global teardown so no pid is lost to races. */
  async drain(): Promise<TargetMap> {
    return this.withLock(async () => {
      const map = await this.read();
      await atomicWriteJson(this.filePath, {});
      return map;
    });
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
