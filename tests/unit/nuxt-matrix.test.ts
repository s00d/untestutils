import { describe, expect, test } from 'vitest';
import { matrix, nuxt } from '../../packages/nuxt/src/index';
import { clearRegisteredRecipes, resetRecipeBindings, defineRecipes } from '@untestutils/core';

describe('nuxt matrix()', () => {
  test('expands variants into distinct recipe ids', () => {
    clearRegisteredRecipes();
    resetRecipeBindings();
    const recipes = defineRecipes({
      ...matrix(
        { id: 'basic', root: process.cwd(), run: 'server', env: { A: '1' } },
        {
          default: { env: { STRATEGY: 'prefix' } },
          noSsr: { nuxtConfig: { ssr: false }, env: { B: '2' } },
        },
      ),
    });
    expect(Object.keys(recipes).sort()).toEqual(['basic', 'basic__noSsr']);
    expect(recipes.basic.id).toBe('basic');
    expect(recipes.basic__noSsr.id).toBe('basic__noSsr');
    expect(recipes.basic).not.toBe(recipes.basic__noSsr);
  });

  test('variants diverge identity hash inputs', async () => {
    clearRegisteredRecipes();
    resetRecipeBindings();
    const recipes = matrix(
      { id: 'hash', root: process.cwd(), run: 'server' },
      {
        default: { env: { STRATEGY: 'prefix' } },
        noSsr: { nuxtConfig: { ssr: false } },
      },
    );
    const a = await recipes.hash.hashInputs!();
    const b = await recipes.hash__noSsr.hashInputs!();
    expect(a).not.toEqual(b);
    expect(a.some((x) => String(x).includes('variant:default'))).toBe(true);
    expect(b.some((x) => String(x).includes('variant:noSsr'))).toBe(true);
  });

  test('preset option is accepted on nuxt() and hashed', async () => {
    const r = nuxt({
      id: 'preset-demo',
      root: process.cwd(),
      run: 'server',
      preset: 'node-server',
      nuxtConfig: { nitro: { minify: false } },
    });
    expect(r.id).toBe('preset-demo');
    const inputs = await r.hashInputs!();
    expect(inputs.some((x) => String(x).includes('preset:node-server'))).toBe(true);
  });
});
