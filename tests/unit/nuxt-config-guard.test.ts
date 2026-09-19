import { describe, expect, test } from 'vitest';
import { assertNoE2ePluginMixed } from '../../packages/nuxt/src/config/index';
import { matrix, nuxt, type NuxtConfigOverride } from '../../packages/nuxt/src/index';
import { clearRegisteredRecipes, resetRecipeBindings, defineRecipes } from '@untestutils/core';

describe('assertNoE2ePluginMixed (nuxt config)', () => {
  test('allows e2e plugin alone', () => {
    expect(() =>
      assertNoE2ePluginMixed({
        plugins: [{ name: 'untestutils' }],
        test: { environment: 'node' },
      }),
    ).not.toThrow();
  });

  test('allows unit environment alone', () => {
    expect(() =>
      assertNoE2ePluginMixed({
        plugins: [],
        test: { environment: 'untestutils' },
      }),
    ).not.toThrow();
  });

  test('throws when e2e plugin + untestutils env', () => {
    expect(() =>
      assertNoE2ePluginMixed({
        plugins: [{ name: 'untestutils' }],
        test: { environment: 'untestutils' },
      }),
    ).toThrow(/Do not mix/);
  });

  test('throws when e2e plugin + nuxt env', () => {
    expect(() =>
      assertNoE2ePluginMixed({
        plugins: [{ name: 'untestutils' }],
        test: { environment: 'nuxt' },
      }),
    ).toThrow(/Do not mix/);
  });

  test('ignores unrelated plugins', () => {
    expect(() =>
      assertNoE2ePluginMixed({
        plugins: [{ name: 'vite:other' }, null, 'string-plugin'],
        test: { environment: 'untestutils' },
      }),
    ).not.toThrow();
  });
});

describe('NuxtConfigOverride typing surface', () => {
  test('nuxt accepts typed nuxtConfig overrides including nitro', async () => {
    clearRegisteredRecipes();
    resetRecipeBindings();
    const override: NuxtConfigOverride = {
      ssr: false,
      nitro: { minify: false, preset: 'node-server' },
    };
    const r = nuxt({
      id: 'typed-cfg',
      root: process.cwd(),
      run: 'server',
      nuxtConfig: override,
      preset: 'node-server',
    });
    const inputs = await r.hashInputs!();
    expect(inputs.some((x) => String(x).includes('preset:node-server'))).toBe(true);
    expect(inputs.some((x) => String(x).includes('nuxtConfig:'))).toBe(true);
  });

  test('matrix merges nitro from NuxtConfigOverride', () => {
    clearRegisteredRecipes();
    resetRecipeBindings();
    const recipes = defineRecipes({
      ...matrix(
        {
          id: 'm',
          root: process.cwd(),
          run: 'server',
          nuxtConfig: { nitro: { minify: true } },
        },
        {
          default: {},
          slim: { nuxtConfig: { nitro: { minify: false }, ssr: false } },
        },
      ),
    });
    expect(recipes.m).toBeTruthy();
    expect(recipes.m__slim).toBeTruthy();
  });
});
