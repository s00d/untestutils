import { describe, expect, test } from 'vitest';
import { clearNuxtImportMocks } from '../../packages/nuxt/src/runtime/shared/reset';

const HOIST = '__NUXT_VITEST_MOCKS';
const FNS = '__NUXT_VITEST_MOCK_FNS';
const ORIGINAL = '__NUXT_VITEST_MOCKS_ORIGINAL';

describe('clearNuxtImportMocks', () => {
  test('restores originals and clears factories', () => {
    const g = globalThis as Record<string, unknown>;
    g[HOIST] = {
      '#imports': {
        useFoo: 'mocked',
        [ORIGINAL]: { useFoo: 'original' },
      },
    };
    g[FNS] = { '#imports': { useFoo: () => 'mocked' } };

    clearNuxtImportMocks();

    expect((g[HOIST] as Record<string, Record<string, unknown>>)['#imports']!.useFoo).toBe(
      'original',
    );
    expect(g[FNS]).toEqual({});
  });
});
