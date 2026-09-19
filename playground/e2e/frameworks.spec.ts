import { describe, expect, test, useHarness } from 'untestutils/vitest';

/**
 * Framework Recipe dogfood — each suite prepares its own fixture.
 * Requires `pnpm install` at repo root so playground/fixtures/* deps resolve.
 */

describe('vite spa', () => {
  async function bundledMark(app: Awaited<ReturnType<typeof useHarness>>, needle: string) {
    const html = await app.$fetch('/');
    expect(html).toContain('vite-spa ok');
    const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]!);
    expect(scripts.length).toBeGreaterThan(0);
    const bodies = await Promise.all(scripts.map((src) => app.$fetch(src)));
    expect(bodies.some((js) => String(js).includes(needle))).toBe(true);
  }

  test('preview serves html', async () => {
    const app = await useHarness('viteSpa');
    await bundledMark(app, 'ut-mark-default');
  });

  test('viteConfig define override reaches the bundle', async () => {
    const app = await useHarness('viteSpaOverride');
    await bundledMark(app, 'ut-mark-override');
  });
});

describe('next static export', () => {
  test('serves exported html', async () => {
    const app = await useHarness('nextStatic');
    const html = await app.$fetch('/');
    expect(html).toContain('next-app ok');
  });

  test('nextConfig env override reaches static HTML', async () => {
    const app = await useHarness('nextStaticOverride');
    const html = await app.$fetch('/');
    // React may insert comment nodes between text (`ut-mark:<!-- -->override-ok`)
    expect(html).toContain('ut-mark:');
    expect(html).toContain('override-ok');
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

  test('kitConfig appDir override appears in HTML', async () => {
    const app = await useHarness('sveltekitKitCfg');
    const html = await app.$fetch('/');
    expect(html).toContain('sveltekit-app ok');
    expect(html).toContain('_app_ut');
  });
});

describe('remix server', () => {
  test('serves built app', async () => {
    const app = await useHarness('remixApp');
    const html = await app.$fetch('/');
    expect(html).toContain('remix-app ok');
  });
});

describe('solidstart preview', () => {
  test('serves built app', async () => {
    const app = await useHarness('solidApp');
    const html = await app.$fetch('/');
    expect(html).toContain('solid-app ok');
  });
});
