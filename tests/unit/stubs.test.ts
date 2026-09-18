import { describe, expect, test } from 'vitest';
import { vite } from '@untestutils/vite';
import viteDefault from '@untestutils/vite';
import { next } from '@untestutils/next';
import nextDefault from '@untestutils/next';
import { astro } from '@untestutils/astro';
import astroDefault from '@untestutils/astro';
import { sveltekit } from '@untestutils/sveltekit';
import sveltekitDefault from '@untestutils/sveltekit';

describe('framework stubs', () => {
  test.each([
    ['vite', vite, viteDefault],
    ['next', next, nextDefault],
    ['astro', astro, astroDefault],
    ['sveltekit', sveltekit, sveltekitDefault],
  ] as const)('%s throws not implemented', (_name, named, def) => {
    expect(() => named({})).toThrow(/not implemented/);
    expect(() => def({})).toThrow(/not implemented/);
  });
});
