import { existsSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'pathe';
import { debug } from './debug';

export interface LockInfo {
  pid: number;
  startedAt: number;
  heartbeatAt: number;
  identity: string;
}

const DEFAULT_STALE_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = 5_000;

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

  constructor(
    private readonly lockPath: string,
    private readonly identity: string,
    private readonly staleMs: number = DEFAULT_STALE_MS,
  ) {}

  async acquire(timeoutMs: number = 120_000): Promise<void> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const handle = await open(this.lockPath, 'wx');
        const info: LockInfo = {
          pid: process.pid,
          startedAt: Date.now(),
          heartbeatAt: Date.now(),
          identity: this.identity,
        };
        await handle.writeFile(JSON.stringify(info), 'utf8');
        await handle.close();
        this.held = true;
        this.startHeartbeat();
        debug('lock', `acquired ${this.lockPath}`);
        return;
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST') throw error;
        /* v8 ignore next */
        if (await this.tryStealStale()) continue;
        await sleep(200);
      }
    }
    throw new Error(`[untestutils] timed out waiting for lock: ${this.lockPath}`);
  }

  async release(): Promise<void> {
    this.stopHeartbeat();
    if (!this.held) return;
    try {
      const raw = await readFile(this.lockPath, 'utf8');
      const info = JSON.parse(raw) as LockInfo;
      if (info.pid === process.pid) {
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
      const info: LockInfo = {
        pid: process.pid,
        startedAt: Date.now(),
        heartbeatAt: Date.now(),
        identity: this.identity,
      };
      // preserve startedAt if possible
      try {
        const prev = JSON.parse(await readFile(this.lockPath, 'utf8')) as LockInfo;
        info.startedAt = prev.startedAt;
      } catch {
        /* */
      }
      await writeFile(this.lockPath, JSON.stringify(info), 'utf8');
    } catch {
      /* lock lost */
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
  return join(artifactsRoot, 'locks', `${identity}.lock`);
}
