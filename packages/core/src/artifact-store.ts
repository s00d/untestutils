import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'pathe';
import { SCHEMA_VERSION } from './types';
import { FileLock, isReady, lockPathFor, markReady, removePath } from './lock';
import { debug } from './debug';
import { refuseArtifactsInsidePackage } from './paths';

export interface BuildMeta {
  schemaVersion: typeof SCHEMA_VERSION;
  hash: string;
  identity: string;
  createdAt: number;
  /** Original `Recipe.id` — GC groups by it (identity prefixes are sanitized). */
  id?: string;
}

export class ArtifactStore {
  constructor(private readonly artifactsRoot: string) {}

  buildDir(identity: string): string {
    return join(this.artifactsRoot, 'builds', identity);
  }

  hashFile(identity: string): string {
    return join(this.buildDir(identity), '.build-hash');
  }

  readyFile(identity: string): string {
    return join(this.buildDir(identity), '.ready');
  }

  metaFile(identity: string): string {
    return join(this.buildDir(identity), '.meta.json');
  }

  lastUsedFile(identity: string): string {
    return join(this.buildDir(identity), '.last-used');
  }

  /** Record that this run used the build (drives {@link pruneBuilds} recency). */
  async touch(identity: string): Promise<void> {
    if (!existsSync(this.buildDir(identity))) return;
    await writeFile(this.lastUsedFile(identity), String(Date.now()), 'utf8').catch(() => {});
  }

  /** Identity owning `dir` when it is a `builds/<identity>` dir of this store. */
  identityOf(dir: string): string | undefined {
    const abs = resolve(dir);
    return dirname(abs) === resolve(this.artifactsRoot, 'builds') ? basename(abs) : undefined;
  }

  async ensureDir(identity: string): Promise<string> {
    const dir = this.buildDir(identity);
    refuseArtifactsInsidePackage(dir);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async isWarm(identity: string, hash: string): Promise<boolean> {
    if (!(await isReady(this.readyFile(identity)))) return false;
    if (!existsSync(this.hashFile(identity))) return false;
    const stored = (await readFile(this.hashFile(identity), 'utf8')).trim();
    return stored === hash;
  }

  async commit(identity: string, hash: string, id?: string): Promise<void> {
    const meta: BuildMeta = {
      schemaVersion: SCHEMA_VERSION,
      hash,
      identity,
      createdAt: Date.now(),
      id,
    };
    await writeFile(this.hashFile(identity), hash, 'utf8');
    await writeFile(this.metaFile(identity), JSON.stringify(meta, null, 2), 'utf8');
    await markReady(this.readyFile(identity));
    debug('artifact', `committed ${identity}`);
  }

  async invalidate(identity: string): Promise<void> {
    await removePath(this.buildDir(identity));
  }
}

export interface PruneBuildsOptions {
  /** Most-recently-used identities kept per recipe id. Default `2`. */
  keep?: number;
  /** Identities used at/after this epoch ms (the current run) are always kept. */
  usedSince?: number;
  /** Identities to always keep (e.g. live registry targets). */
  protect?: Iterable<string>;
  /** Unfinished (no `.ready`) dirs younger than this are treated as in-flight builds. Default 10 min. */
  incompleteGraceMs?: number;
}

export interface PruneBuildsResult {
  removed: string[];
  kept: string[];
}

const IDENTITY_RE = /^(.+)-[0-9a-f]{12}$/;

/**
 * Drop stale build identities under `<artifactsRoot>/builds`: per recipe id keep the
 * newest `keep` (by last use) plus everything used in this run. A dir is only removed
 * while holding its identity lock, so an in-flight build is never deleted.
 */
export async function pruneBuilds(
  artifactsRoot: string,
  opts: PruneBuildsOptions = {},
): Promise<PruneBuildsResult> {
  const keep = Math.max(0, opts.keep ?? 2);
  const grace = opts.incompleteGraceMs ?? 10 * 60 * 1000;
  const protect = new Set(opts.protect ?? []);
  const store = new ArtifactStore(artifactsRoot);
  const result: PruneBuildsResult = { removed: [], kept: [] };

  let names: string[];
  try {
    names = (await readdir(join(artifactsRoot, 'builds'), { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return result;
  }

  type Entry = { identity: string; usedAt: number; ready: boolean; id?: string };
  const groups = new Map<string, Entry[]>();
  for (const identity of names) {
    const prefix = IDENTITY_RE.exec(identity)?.[1];
    if (!prefix) continue; // not ours — never touch
    const ready = existsSync(store.readyFile(identity));
    const usedAt = await lastUsedAt(store, identity);
    if (!ready && Date.now() - usedAt < grace) {
      result.kept.push(identity);
      continue;
    }
    const id = await readMeta(store, identity).then((m) => m?.id);
    const key = id ?? prefix;
    const list = groups.get(key) ?? [];
    list.push({ identity, usedAt, ready, id });
    groups.set(key, list);
  }

  for (const list of groups.values()) {
    // Only finished builds count towards `keep`; abandoned partial dirs are always candidates.
    const ready = list.filter((e) => e.ready).sort((a, b) => b.usedAt - a.usedAt);
    const keepSet = new Set(ready.slice(0, keep).map((e) => e.identity));
    const recent = (usedAt: number) => opts.usedSince !== undefined && usedAt >= opts.usedSince;
    for (const entry of list) {
      if (keepSet.has(entry.identity) || recent(entry.usedAt) || protect.has(entry.identity)) {
        result.kept.push(entry.identity);
        continue;
      }
      // Identity lock guards prepare/start; `share:'never'` serializes on the recipe id instead.
      const keys = [entry.identity, ...(entry.id && entry.id !== entry.identity ? [entry.id] : [])];
      const locks = keys.map((k) => new FileLock(lockPathFor(artifactsRoot, k), k));
      const held: FileLock[] = [];
      for (const lock of locks) {
        if (!(await lock.tryAcquire())) break;
        held.push(lock);
      }
      try {
        // Re-check under the lock: a worker may have used it since the scan.
        if (held.length < locks.length || recent(await lastUsedAt(store, entry.identity))) {
          result.kept.push(entry.identity);
          continue;
        }
        await store.invalidate(entry.identity);
        result.removed.push(entry.identity);
        debug('artifact', `pruned ${entry.identity}`);
      } finally {
        for (const lock of held) await lock.release();
      }
    }
  }
  return result;
}

async function readMeta(store: ArtifactStore, identity: string): Promise<BuildMeta | undefined> {
  try {
    return JSON.parse(await readFile(store.metaFile(identity), 'utf8')) as BuildMeta;
  } catch {
    return undefined;
  }
}

async function lastUsedAt(store: ArtifactStore, identity: string): Promise<number> {
  try {
    const n = Number((await readFile(store.lastUsedFile(identity), 'utf8')).trim());
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    /* pre-0.8 build — fall back to meta / mtime */
  }
  const meta = await readMeta(store, identity);
  if (meta?.createdAt) return meta.createdAt;
  try {
    return (await stat(store.buildDir(identity))).mtimeMs;
  } catch {
    return 0;
  }
}
