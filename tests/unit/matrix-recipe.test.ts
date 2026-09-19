import { describe, expect, test } from 'vitest';
import {
  matrixRecipe,
  shouldIncludeWorkspaceDeps,
  findWorkspaceRoot,
  defineRecipe,
  type Recipe,
} from '@untestutils/core';
import { join } from 'pathe';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

type Opts = {
  id?: string;
  root: string;
  env?: Record<string, string>;
  hashInputs?: string[];
  run?: string;
};

function fakeFactory(opts: Opts): Recipe {
  return defineRecipe({
    id: opts.id ?? 'x',
    share: 'always',
    hashInputs: async () => [
      ...(opts.hashInputs ?? [opts.root]),
      ...(opts.env ? [`env:${JSON.stringify(opts.env)}`] : []),
      ...(opts.run ? [`run:${opts.run}`] : []),
    ],
    ready: async () => {},
    start: async () => ({
      kind: 'url',
      url: 'http://127.0.0.1:1/',
      stop: async () => {},
    }),
  });
}

describe('matrixRecipe', () => {
  test('expands variants into distinct recipe ids', () => {
    const recipes = matrixRecipe(
      fakeFactory,
      { id: 'app', root: '/tmp/app', env: { A: '1' } },
      {
        default: { env: { STRATEGY: 'prefix' } },
        alt: { env: { B: '2' }, run: 'dev' },
      },
      { label: 'test' },
    );
    expect(Object.keys(recipes).sort()).toEqual(['app', 'app__alt']);
    expect(recipes.app.id).toBe('app');
    expect(recipes.app__alt.id).toBe('app__alt');
  });

  test('variants diverge hash inputs', async () => {
    const recipes = matrixRecipe(
      fakeFactory,
      { id: 'hash', root: '/tmp/x' },
      {
        default: { env: { STRATEGY: 'prefix' } },
        other: { env: { STRATEGY: 'no' } },
      },
      { label: 'test' },
    );
    const a = await recipes.hash.hashInputs!();
    const b = await recipes.hash__other.hashInputs!();
    expect(a).not.toEqual(b);
    expect(a.some((x) => String(x).includes('variant:default'))).toBe(true);
    expect(b.some((x) => String(x).includes('variant:other'))).toBe(true);
  });

  test('duplicate id throws', () => {
    expect(() =>
      matrixRecipe(
        fakeFactory,
        { id: 'dup', root: '/tmp/x' },
        {
          default: {},
          other: {},
        },
        {
          label: 'test',
          merge: (base, _patch, _id, variantName) => ({
            ...base,
            id: 'always-same',
            hashInputs: [`variant:${variantName}`],
          }),
        },
      ),
    ).toThrow(/duplicate id/);
  });

  test('requires base.root', () => {
    expect(() =>
      matrixRecipe(fakeFactory, { id: 'x', root: '' }, { default: {} }, { label: 'test' }),
    ).toThrow(/requires base.root/);
  });
});

describe('workspaceDeps helpers', () => {
  test('shouldIncludeWorkspaceDeps respects flags', () => {
    expect(shouldIncludeWorkspaceDeps(false, process.cwd())).toBe(false);
    expect(shouldIncludeWorkspaceDeps(undefined, process.cwd())).toBe(false);
    expect(shouldIncludeWorkspaceDeps(true, process.cwd())).toBe(true);
    // this repo is a pnpm workspace
    expect(shouldIncludeWorkspaceDeps('auto', process.cwd())).toBe(true);
  });

  test('findWorkspaceRoot walks up', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-ws-'));
    const nested = join(dir, 'a', 'b');
    await mkdir(nested, { recursive: true });
    await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    expect(findWorkspaceRoot(nested)).toBe(dir);
  });
});
