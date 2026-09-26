import { describe, expect, test } from 'vitest';
import {
  resolveUnitFramework,
  UNIT_FRAMEWORK_PACKAGES,
} from '../../packages/vitest/src/unit-dom/resolve-framework.ts';
import env, {
  resolveUnitFramework as resolveFromEnv,
  UNIT_FRAMEWORK_PACKAGES as packagesFromEnv,
} from '../../packages/vitest-environment-untestutils/index.mjs';

describe('unit-env router', () => {
  test('exposes untestutils environment with setup', () => {
    expect(env.name).toBe('untestutils');
    expect(env.viteEnvironment).toBe('client');
    expect(typeof env.setup).toBe('function');
  });

  test('defaults to nuxt when no framework hint', () => {
    expect(resolveUnitFramework({})).toBe('nuxt');
  });

  test('legacy environmentOptions.nuxt resolves to nuxt', () => {
    expect(resolveUnitFramework({ nuxt: { rootDir: '/tmp' } })).toBe('nuxt');
    expect(resolveUnitFramework({ nuxtRuntimeConfig: { public: {} } })).toBe('nuxt');
  });

  test('environmentOptions.untestutils.framework selects vite', () => {
    expect(resolveUnitFramework({ untestutils: { framework: 'vite' } })).toBe('vite');
    expect(resolveUnitFramework({ untestutils: { framework: 'Next' } })).toBe('next');
  });

  test('top-level environmentOptions.vite selects vite', () => {
    expect(resolveUnitFramework({ vite: { domEnvironment: 'happy-dom' } })).toBe('vite');
  });

  test('ambiguous top-level framework keys throw', () => {
    expect(() => resolveUnitFramework({ vite: {}, next: {} })).toThrow(/ambiguous/);
  });

  test('unknown framework throws clearly', () => {
    expect(() => resolveUnitFramework({ untestutils: { framework: 'django' } })).toThrow(
      /unknown unit framework "django"/,
    );
  });

  test('package map covers all frameworks', () => {
    expect(Object.keys(UNIT_FRAMEWORK_PACKAGES).sort()).toEqual(
      ['astro', 'next', 'nuxt', 'remix', 'solidstart', 'sveltekit', 'vite'].sort(),
    );
    expect(packagesFromEnv).toEqual(UNIT_FRAMEWORK_PACKAGES);
    expect(resolveFromEnv({ untestutils: { framework: 'astro' } })).toBe('astro');
  });
});

describe('shared unit-dom teardown contract', () => {
  test('setupUnitDom returns window + teardown that restores globals', async () => {
    // Import built module so Vite does not rewrite `vitest/${sub}` subpath resolution.
    const { setupUnitDom } = await import('../../packages/vitest/dist/unit-dom/index.mjs');
    const global = globalThis as typeof globalThis & { console: Console };
    const beforeKeys = new Set(Object.getOwnPropertyNames(global));
    const { window, teardown } = await setupUnitDom(global, {
      url: 'http://localhost:3999/',
      domEnvironment: 'happy-dom',
      mock: { intersectionObserver: true },
    });
    expect(window.document).toBeTruthy();
    teardown();
    for (const key of Object.getOwnPropertyNames(global)) {
      if (beforeKeys.has(key)) continue;
      if (key === 'IntersectionObserver') continue;
      throw new Error(`unexpected leaked global key after unit-dom teardown: ${key}`);
    }
  });
});
