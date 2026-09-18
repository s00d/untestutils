import { describe, expect, test } from 'vitest';
import env from '../../packages/vitest-environment-untestutils/index.mjs';

describe('vitest-environment-untestutils', () => {
  test('exposes an untestutils environment', () => {
    expect(env.name).toBe('untestutils');
    expect(env.viteEnvironment).toBe('client');
    expect(typeof env.setup).toBe('function');
  });
});
