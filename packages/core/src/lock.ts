import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  type FileHandle,
  link,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'pathe';
import { debug } from './debug';
import { runStateDir } from './paths';

export interface LockInfo {
  pid: number;
  startedAt: number;
  heartbeatAt: number;
  identity: string;
  /** Per-instance owner token (diagnostics; ownership is checked by inode). */
  token?: string;
}

const DEFAULT_STALE_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = 5_000;
/** Holder counts as alive-and-working while its heartbeat is younger than this. */
const FRESH_HEARTBEAT_MS = HEARTBEAT_MS * 6;

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class FileLock {
  private heartbeat?: ReturnType<typeof setInterval>;
  private held = false;
  private readonly token = randomUUID();
  /** Open while held: heartbeats write through it, so they only ever touch our own inode. */
  private handle?: FileHandle;
  private info?: LockInfo;
  private ino?: number;

  constructor(
    private readonly lockPath: string,
    private readonly identity: string,
    private readonly staleMs: number = DEFAULT_STALE_MS,
  ) {}

  /**
   * Wait for the lock. `timeoutMs` only runs while the holder looks hung: a live holder
   * with a fresh heartbeat (e.g. a long build) keeps the wait going indefinitely. A dead
   * pid or a heartbeat older than `staleMs` is stolen.
   */
  async acquire(timeoutMs: number = 120_000): Promise<void> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    const waitStart = Date.now();
    let deadline = waitStart + timeoutMs;
    let holder: LockInfo | undefined;
    while (Date.now() < deadline) {
      if (await this.tryCreate()) return;
      /* v8 ignore next */
      if (await this.tryStealStale()) continue;
      holder = await this.readInfo();
      if (holder && isHolderFresh(holder)) {
        deadline = Math.max(deadline, Date.now() + timeoutMs);
      }
      await sleep(200);
    }
    throw new Error(lockTimeoutMessage(this.lockPath, timeoutMs, Date.now() - waitStart, holder));
  }

  /** Single non-blocking attempt (steals a stale lock). `false` when someone else holds it. */
  async tryAcquire(): Promise<boolean> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    if (await this.tryCreate()) return true;
    return (await this.tryStealStale()) && this.tryCreate();
  }

  /** `open(wx)` the lock file; `false` on EEXIST. */
  private async tryCreate(): Promise<boolean> {
    let handle: FileHandle;
    try {
      handle = await open(this.lockPath, 'wx');
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
    const now = Date.now();
    this.info = {
      pid: process.pid,
      startedAt: now,
      heartbeatAt: now,
      identity: this.identity,
      token: this.token,
    };
    await handle.writeFile(JSON.stringify(this.info), 'utf8');
    this.ino = (await handle.stat()).ino;
    this.handle = handle;
    this.held = true;
    this.startHeartbeat();
    debug('lock', `acquired ${this.lockPath}`);
    return true;
  }

  async release(): Promise<void> {
    this.stopHeartbeat();
    if (!this.held) return;
    const ino = this.ino;
    await this.handle?.close().catch(() => {});
    this.handle = undefined;
    // Only remove the file if it is still our inode (a stale takeover may have replaced it).
    // A waiter may have our file moved aside for a staleness check — retry briefly.
    for (let i = 0; i < 20; i++) {
      if (await removeLockIf(this.lockPath, async (tmp) => (await stat(tmp)).ino === ino)) break;
      const now = await stat(this.lockPath).catch(() => undefined);
      if (now && now.ino !== ino) break; // replaced by a new holder — not ours to delete
      await sleep(10);
    }
    this.held = false;
    debug('lock', `released ${this.lockPath}`);
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      void this.beat();
    }, HEARTBEAT_MS);
    this.heartbeat.unref?.();
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }

  private async beat(): Promise<void> {
    const handle = this.handle;
    if (!handle || !this.info) return;
    try {
      // Write through our fd: if the path was released or taken over, this updates only the
      // orphaned inode — it can never recreate the path or clobber another holder's file.
      const buf = Buffer.from(JSON.stringify({ ...this.info, heartbeatAt: Date.now() }));
      await handle.write(buf, 0, buf.length, 0);
      await handle.truncate(buf.length);
    } catch {
      /* lock lost / handle closed */
    }
  }

  private async readInfo(): Promise<LockInfo | undefined> {
    try {
      return JSON.parse(await readFile(this.lockPath, 'utf8')) as LockInfo;
    } catch {
      return undefined;
    }
  }

  private async tryStealStale(): Promise<boolean> {
    // Cheap read first — only a lock that looks stale is moved aside.
    if (!(await this.looksStale(this.lockPath))) return false;
    // Re-check staleness on the file we actually moved away: another waiter may already
    // have stolen it and created a fresh lock in its place.
    return removeLockIf(this.lockPath, (tmp) => this.looksStale(tmp, true));
  }

  private async looksStale(path: string, log = false): Promise<boolean> {
    try {
      const info = JSON.parse(await readFile(path, 'utf8')) as LockInfo;
      const staleByTime = Date.now() - (info.heartbeatAt || info.startedAt) > this.staleMs;
      const dead = !isPidAlive(info.pid);
      if (log && (staleByTime || dead)) {
        debug('lock', `stealing stale lock pid=${info.pid} dead=${dead}`);
      }
      return staleByTime || dead;
    } catch {
      try {
        return Date.now() - (await stat(path)).mtimeMs > this.staleMs;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Atomically move the lock aside, then delete it only if `shouldRemove(movedPath)`;
 * otherwise put it back. The path never points at a file we did not inspect.
 * ponytail: restoring uses link(), which fails if a new lock appeared in the tiny
 * rename→link window — then the inspected lock is dropped (its holder keeps running).
 */
async function removeLockIf(
  lockPath: string,
  shouldRemove: (movedPath: string) => Promise<boolean>,
): Promise<boolean> {
  const tmp = `${lockPath}.${process.pid}.${randomUUID()}.check`;
  try {
    await rename(lockPath, tmp);
  } catch {
    return false; // already gone
  }
  let remove = false;
  try {
    remove = await shouldRemove(tmp);
  } catch {
    remove = false;
  }
  if (!remove) await link(tmp, lockPath).catch(() => {});
  await unlink(tmp).catch(() => {});
  return remove;
}

function isHolderFresh(info: LockInfo): boolean {
  return (
    isPidAlive(info.pid) && Date.now() - (info.heartbeatAt || info.startedAt) < FRESH_HEARTBEAT_MS
  );
}

function lockTimeoutMessage(
  lockPath: string,
  timeoutMs: number,
  waitedMs: number,
  holder: LockInfo | undefined,
): string {
  const head = `[untestutils] timed out after ${Math.round(waitedMs / 1000)}s waiting for lock ${lockPath}`;
  if (!holder) return `${head} (holder unknown — lock file unreadable)`;
  const now = Date.now();
  const beat = Math.round((now - (holder.heartbeatAt || holder.startedAt)) / 1000);
  const held = Math.round((now - holder.startedAt) / 1000);
  return (
    `${head}: holder pid=${holder.pid} (${isPidAlive(holder.pid) ? 'alive' : 'dead'}) ` +
    `identity=${holder.identity}, held ${held}s, last heartbeat ${beat}s ago ` +
    `(no fresh heartbeat for ${Math.round(timeoutMs / 1000)}s). ` +
    `If that process is hung, kill it or delete the lock file.`
  );
}

export async function atomicWriteJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await rename(tmp, path);
}

export async function atomicWriteText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, path);
}

export async function markReady(readyPath: string): Promise<void> {
  await atomicWriteText(readyPath, String(Date.now()));
}

export async function isReady(readyPath: string): Promise<boolean> {
  return existsSync(readyPath);
}

export async function removePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function lockPathFor(artifactsRoot: string, identity: string): string {
  return join(runStateDir(artifactsRoot), 'locks', `${identity}.lock`);
}
