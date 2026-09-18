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

  test('vite() returns preview recipe', () => {
    const r = vite({ id: 'v', root: '/tmp/app', run: 'preview' });
    expect(r.id).toBe('v');
    expect(r.share).toBe('always');
    expect(typeof r.start).toBe('function');
  });
});
