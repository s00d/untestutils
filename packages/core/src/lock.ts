import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'pathe';
import { debug } from './debug';
import { runStateDir } from './paths';

export interface LockInfo {
  pid: number;
  startedAt: number;
  heartbeatAt: number;
  identity: string;
  /** Per-instance owner token — guards heartbeat/release against a stolen lock (same pid). */
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
    let handle;
    try {
      handle = await open(this.lockPath, 'wx');
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
    const now = Date.now();
    const info: LockInfo = {
      pid: process.pid,
      startedAt: now,
      heartbeatAt: now,
      identity: this.identity,
      token: this.token,
    };
    await handle.writeFile(JSON.stringify(info), 'utf8');
    await handle.close();
    this.held = true;
    this.startHeartbeat();
    debug('lock', `acquired ${this.lockPath}`);
    return true;
  }

  async release(): Promise<void> {
    this.stopHeartbeat();
    if (!this.held) return;
    try {
      const raw = await readFile(this.lockPath, 'utf8');
      const info = JSON.parse(raw) as LockInfo;
      if (info.pid === process.pid && (!info.token || info.token === this.token)) {
        await unlink(this.lockPath);
      }
    } catch {
      /* already gone */
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
    try {
      const prev = await this.readInfo();
      // Lock was stolen (or released) — never overwrite another holder's file.
      if (!prev || prev.token !== this.token) {
        this.stopHeartbeat();
        return;
      }
      await writeFile(this.lockPath, JSON.stringify({ ...prev, heartbeatAt: Date.now() }), 'utf8');
    } catch {
      /* lock lost */
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
    try {
      const raw = await readFile(this.lockPath, 'utf8');
      const info = JSON.parse(raw) as LockInfo;
      const staleByTime = Date.now() - (info.heartbeatAt || info.startedAt) > this.staleMs;
      const dead = !isPidAlive(info.pid);
      if (staleByTime || dead) {
        debug('lock', `stealing stale lock pid=${info.pid} dead=${dead}`);
        await unlink(this.lockPath);
        return true;
      }
    } catch {
      try {
        const s = await stat(this.lockPath);
        if (Date.now() - s.mtimeMs > this.staleMs) {
          await unlink(this.lockPath);
          return true;
        }
      } catch {
        /* */
      }
    }
    return false;
  }
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
