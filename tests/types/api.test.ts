import { describe, expectTypeOf, test } from 'vitest';
import type { Recipe, HarnessHandle, SharePolicy } from '../../packages/core/src/types';
import type { UntestutilsPluginOptions } from '../../packages/vitest/src/plugin';

describe('public types', () => {
  test('Recipe shape', () => {
    expectTypeOf<Recipe>().toHaveProperty('start');
    expectTypeOf<SharePolicy>().toEqualTypeOf<'always' | 'never' | 'prepare-only'>();
  });

  test('HarnessHandle', () => {
    expectTypeOf<HarnessHandle>().toHaveProperty('$fetch');
    expectTypeOf<HarnessHandle>().toHaveProperty('files');
  });

  test('plugin options', () => {
    expectTypeOf<UntestutilsPluginOptions>().toHaveProperty('prewarm');
    expectTypeOf<UntestutilsPluginOptions>().toHaveProperty('recipesModule');
  });
});
