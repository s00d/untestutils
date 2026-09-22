import { describe, expect, test } from 'vitest';
import { nuxt } from '../../packages/nuxt/src/index';
import { vite } from '../../packages/vite/src/index';

describe('framework factories', () => {
  test('nuxt() defaults to server (shared prepare)', () => {
    const r = nuxt({ id: 'n', root: '/tmp/app', run: 'server' });
    expect(r.id).toBe('n');
    expect(r.share).toBe('always');
    expect(typeof r.start).toBe('function');
    expect(typeof r.prepare).toBe('function');
  });

  test('nuxt({ run: "dev" }) is never-shared HMR escape hatch', () => {
    const r = nuxt({ id: 'n-dev', root: '/tmp/app', run: 'dev' });
    expect(r.share).toBe('never');
    expect(r.prepare).toBeUndefined();
  });

  test('vite() returns preview recipe', () => {
    const r = vite({ id: 'v', root: '/tmp/app', run: 'preview' });
    expect(r.id).toBe('v');
    expect(r.share).toBe('always');
    expect(typeof r.start).toBe('function');
  });
});
