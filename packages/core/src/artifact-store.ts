import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'pathe';
import { SCHEMA_VERSION } from './types';
import { isReady, markReady, removePath } from './lock';
import { debug } from './debug';
import { refuseArtifactsInsidePackage } from './paths';

export interface BuildMeta {
  schemaVersion: typeof SCHEMA_VERSION;
  hash: string;
  identity: string;
  createdAt: number;
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

  async commit(identity: string, hash: string): Promise<void> {
    const meta: BuildMeta = {
      schemaVersion: SCHEMA_VERSION,
      hash,
      identity,
      createdAt: Date.now(),
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
