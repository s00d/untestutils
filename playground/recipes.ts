import { defineRecipes, staticDir, host } from 'untestutils';
import { vite } from 'untestutils/vite';
import { next } from 'untestutils/next';
import { astro } from 'untestutils/astro';
import { sveltekit } from 'untestutils/sveltekit';
import { remix } from 'untestutils/remix';
import { solidstart } from 'untestutils/solidstart';
import { nuxt } from 'untestutils/nuxt';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

const root = dirname(fileURLToPath(import.meta.url));
const remoteUrl = process.env.UNTESTUTILS_REMOTE_URL;

/**
 * Explicit recipe ids per (adapter, run). CI dogfoods every claimed mode.
 * Markers asserted in e2e/<fw>/<mode>.spec.ts — keep in sync with assert-e2e-mode-matrix.mjs.
 */
export const recipes = defineRecipes(
  {
    staticSite: staticDir({
      id: 'staticSite',
      root: join(root, 'fixtures/static-site'),
    }),

    viteSpa: vite({
      id: 'viteSpa',
      root: join(root, 'fixtures/vite-spa'),
      run: 'preview',
    }),
    viteSpaOverride: vite({
      id: 'viteSpaOverride',
      root: join(root, 'fixtures/vite-spa'),
      run: 'preview',
      viteConfig: {
        define: { __UT_MARK__: JSON.stringify('ut-mark-override') },
        build: { outDir: 'dist-override' },
      },
    }),
    viteSpaDev: vite({
      id: 'viteSpaDev',
      root: join(root, 'fixtures/vite-spa'),
      run: 'dev',
    }),

    nextStatic: next({
      id: 'nextStatic',
      root: join(root, 'fixtures/next-app'),
      run: 'static',
    }),
    nextStaticOverride: next({
      id: 'nextStaticOverride',
      root: join(root, 'fixtures/next-app-override'),
      run: 'static',
      nextConfig: { env: { UT_MARK: 'override-ok' } },
    }),
    nextServer: next({
      id: 'nextServer',
      root: join(root, 'fixtures/next-server'),
      run: 'server',
    }),
    nextDev: next({
      id: 'nextDev',
      root: join(root, 'fixtures/next-dev'),
      run: 'dev',
    }),

    astroSite: astro({
      id: 'astroSite',
      root: join(root, 'fixtures/astro-site'),
      run: 'preview',
    }),
    astroServer: astro({
      id: 'astroServer',
      root: join(root, 'fixtures/astro-ssr'),
      run: 'server',
    }),
    astroDev: astro({
      id: 'astroDev',
      root: join(root, 'fixtures/astro-site'),
      run: 'dev',
    }),

    sveltekitApp: sveltekit({
      id: 'sveltekitApp',
      root: join(root, 'fixtures/sveltekit-app'),
      run: 'preview',
    }),
    sveltekitKitCfg: sveltekit({
      id: 'sveltekitKitCfg',
      root: join(root, 'fixtures/sveltekit-app'),
      run: 'preview',
      kitConfig: { kit: { appDir: '_app_ut' } },
    }),
    sveltekitServer: sveltekit({
      id: 'sveltekitServer',
      root: join(root, 'fixtures/sveltekit-node'),
      run: 'server',
    }),
    sveltekitDev: sveltekit({
      id: 'sveltekitDev',
      root: join(root, 'fixtures/sveltekit-app'),
      run: 'dev',
    }),

    remixApp: remix({
      id: 'remixApp',
      root: join(root, 'fixtures/remix-app'),
      run: 'server',
    }),
    remixDev: remix({
      id: 'remixDev',
      root: join(root, 'fixtures/remix-app'),
      run: 'dev',
      readyTimeoutMs: 180_000,
    }),

    solidApp: solidstart({
      id: 'solidApp',
      root: join(root, 'fixtures/solid-app'),
      run: 'preview',
    }),
    // run:'server' (node .output/server) is Experimental — concurrent vinxi builds on this
    // fixture race, and entry-client/SSR path is fragile. Dogfood built mode via preview.
    solidDev: solidstart({
      id: 'solidDev',
      root: join(root, 'fixtures/solid-app'),
      run: 'dev',
    }),

    nuxtServer: nuxt({
      id: 'nuxtServer',
      root: join(root, 'fixtures/unit-app'),
      run: 'server',
    }),
    nuxtStatic: nuxt({
      id: 'nuxtStatic',
      root: join(root, 'fixtures/unit-app'),
      run: 'static',
    }),
    nuxtDev: nuxt({
      id: 'nuxtDev',
      root: join(root, 'fixtures/unit-app'),
      run: 'dev',
    }),

    ...(remoteUrl
      ? {
          remote: host({
            id: 'remote',
            url: remoteUrl,
          }),
        }
      : {}),
  },
  import.meta.url,
);

/** Expected (id → html substring) for assert-e2e-mode-matrix.mjs */
export const E2E_MODE_MARKERS: Record<string, string> = {
  staticSite: 'Playground Static',
  viteSpa: 'vite-spa ok',
  viteSpaDev: 'vite-spa ok',
  nextStatic: 'next-app ok',
  nextServer: 'next-server ok',
  nextDev: 'next-dev ok',
  astroSite: 'astro-site ok',
  astroServer: 'astro-ssr ok',
  astroDev: 'astro-site ok',
  sveltekitApp: 'sveltekit-app ok',
  sveltekitServer: 'sveltekit-node ok',
  sveltekitDev: 'sveltekit-app ok',
  remixApp: 'remix-app ok',
  remixDev: 'remix-app ok',
  solidApp: 'solid-app ok',
  solidDev: 'solid-app ok',
  nuxtServer: 'Unit App',
  nuxtStatic: 'Unit App',
  nuxtDev: 'Unit App',
};
