import { describe, expect, test } from 'vitest';
import { nuxt } from '../../packages/nuxt/src/index';
import { vite } from '../../packages/vite/src/index';

describe('framework factories', () => {
  test('nuxt() returns recipe with start + share', () => {
    const r = nuxt({ id: 'n', root: '/tmp/app', run: 'dev' });
    expect(r.id).toBe('n');
    expect(r.share).toBe('never');
    expect(typeof r.start).toBe('function');
  });

  test('vite stub throws', () => {
    expect(() => vite({ root: '.' })).toThrow(/not implemented/);
  });
});
