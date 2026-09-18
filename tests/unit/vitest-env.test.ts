import { describe, expect, test } from 'vitest';
import env from '../../packages/vitest-environment-untestutils/index.mjs';

describe('vitest-environment-untestutils', () => {
  test('setup throws v0.2; teardown no-op', async () => {
    expect(env.name).toBe('untestutils');
    await expect(env.setup()).rejects.toThrow(/v0\.2/);
    await expect(env.teardown()).resolves.toBeUndefined();
  });
});
