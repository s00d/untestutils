import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { contentHash, sha1, hashString } from '../../packages/core/src/hash';
import { TargetRegistry } from '../../packages/core/src/target-registry';
import { ArtifactStore } from '../../packages/core/src/artifact-store';
import { LOOPBACK_HOST, normalizeBaseUrl, loopbackUrl } from '../../packages/core/src/paths';
import { defineRecipes, clearRegisteredRecipes } from '../../packages/core/src/recipes';
import { resetRecipeBindings } from '../../packages/core/src/identity';
import { defineRecipe } from '../../packages/core/src/recipes';

describe('hash', () => {
  test('sha1 stable', () => {
    expect(sha1('abc')).toBe(sha1('abc'));
    expect(hashString('x')).toHaveLength(40);
  });

  test('contentHash changes when file changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'untestutils-hash-'));
    const f = join(dir, 'a.txt');
    await writeFile(f, 'one');
    const h1 = await contentHash([dir]);
    await writeFile(f, 'two');
    const h2 = await contentHash([dir]);
    expect(h1).not.toBe(h2);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('paths', () => {
  test('loopback constants', () => {
    expect(LOOPBACK_HOST).toBe('127.0.0.1');
    expect(loopbackUrl(3000)).toBe('http://127.0.0.1:3000/');
    expect(normalizeBaseUrl('http://localhost:3000/')).toContain('127.0.0.1');
  });
});

describe('TargetRegistry', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'untestutils-reg-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.UNTESTUTILS_HOST_BASIC;
  });

  test('atomic set/get + env', async () => {
    const reg = new TargetRegistry(dir);
    await reg.set({ id: 'basic', identity: 'basic-abc', url: 'http://localhost:3456/' });
    const entry = await reg.get('basic');
    expect(entry?.url).toContain('127.0.0.1');
    expect(process.env.UNTESTUTILS_HOST_BASIC).toContain('127.0.0.1');
  });
});

describe('ArtifactStore', () => {
  test('warm cache', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'untestutils-art-'));
    const store = new ArtifactStore(dir);
    await store.ensureDir('id1');
    expect(await store.isWarm('id1', 'hash')).toBe(false);
    await store.commit('id1', 'hash');
    expect(await store.isWarm('id1', 'hash')).toBe(true);
    expect(await store.isWarm('id1', 'other')).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });
});

describe('defineRecipes', () => {
  beforeEach(() => {
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  test('registers ids; same-batch duplicates throw; re-import is idempotent', () => {
    const start = async () => ({ kind: 'dir' as const, dir: '/tmp' });
    defineRecipes({
      a: defineRecipe({ id: 'a', start }),
    });
    // Re-import / second defineRecipes with same id — ok (config + globalSetup).
    expect(() =>
      defineRecipes({
        a: defineRecipe({ id: 'a', start }),
      }),
    ).not.toThrow();
    expect(() =>
      defineRecipes({
        a: defineRecipe({ id: 'a', start }),
        b: defineRecipe({ id: 'a', start }),
      }),
    ).toThrow(/duplicate/);
  });
});

describe('refuseArtifactsInsidePackage', () => {
  test('allows .untestutils paths', async () => {
    const { refuseArtifactsInsidePackage } = await import('../../packages/core/src/paths');
    expect(() => refuseArtifactsInsidePackage('/tmp/repo/.untestutils/builds/x')).not.toThrow();
  });

  test('refuses path inside playground fixture member', async () => {
    const { refuseArtifactsInsidePackage } = await import('../../packages/core/src/paths');
    const inside = join(process.cwd(), 'playground/fixtures/static-site/builds/oops');
    expect(() => refuseArtifactsInsidePackage(inside)).toThrow(/refusing/);
  });
});

describe('identity differs by hashInputs', () => {
  beforeEach(() => {
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  test('two recipes with different hash content get different identities', async () => {
    const { computeIdentity } = await import('../../packages/core/src/identity');
    const dir = await mkdtemp(join(tmpdir(), 'untestutils-id-'));
    const a = join(dir, 'a.txt');
    const b = join(dir, 'b.txt');
    await writeFile(a, 'one');
    await writeFile(b, 'two');
    const artifacts = await mkdtemp(join(tmpdir(), 'untestutils-art-'));
    const r1 = defineRecipe({
      id: 'cfg',
      hashInputs: async () => [a],
      start: async () => ({ kind: 'dir', dir }),
    });
    const r2 = defineRecipe({
      id: 'cfg',
      hashInputs: async () => [b],
      start: async () => ({ kind: 'dir', dir }),
    });
    const i1 = await computeIdentity(r1, artifacts);
    // reset binding so same id can rematch different identity in test (simulates config override = new hash)
    resetRecipeBindings();
    const i2 = await computeIdentity(r2, artifacts);
    expect(i1.identity).not.toBe(i2.identity);
    await rm(dir, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });
});
