import { describe, expect, test, useHarness } from 'untestutils/vitest';

/**
 * Framework Recipe dogfood — each suite prepares its own fixture.
 * Requires `pnpm install` at repo root so playground/fixtures/* deps resolve.
 */

describe('vite spa', () => {
  test('preview serves html', async () => {
    const app = await useHarness('viteSpa');
    const html = await app.$fetch('/');
    expect(html).toContain('vite-spa ok');
  });
});

describe('next static export', () => {
  test('serves exported html', async () => {
    const app = await useHarness('nextStatic');
    const html = await app.$fetch('/');
    expect(html).toContain('next-app ok');
  });
});

describe('astro preview', () => {
  test('serves built site', async () => {
    const app = await useHarness('astroSite');
    const html = await app.$fetch('/');
    expect(html).toContain('astro-site ok');
  });
});

describe('sveltekit preview', () => {
  test('serves built site', async () => {
    const app = await useHarness('sveltekitApp');
    const html = await app.$fetch('/');
    expect(html).toContain('sveltekit-app ok');
  });
});
