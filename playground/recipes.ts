import { defineRecipes, staticDir, host } from 'untestutils';
import { vite } from 'untestutils/vite';
import { next } from 'untestutils/next';
import { astro } from 'untestutils/astro';
import { sveltekit } from 'untestutils/sveltekit';
import { remix } from 'untestutils/remix';
import { solidstart } from 'untestutils/solidstart';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

const root = dirname(fileURLToPath(import.meta.url));

const remoteUrl = process.env.UNTESTUTILS_REMOTE_URL;

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
    /** Dogfood typed viteConfig override (define merges over fixture default). */
    viteSpaOverride: vite({
      id: 'viteSpaOverride',
      root: join(root, 'fixtures/vite-spa'),
      run: 'preview',
      viteConfig: {
        define: { __UT_MARK__: JSON.stringify('ut-mark-override') },
        // Separate outDir so shared-root recipes do not clobber each other's dist.
        build: { outDir: 'dist-override' },
      },
    }),
    nextStatic: next({
      id: 'nextStatic',
      root: join(root, 'fixtures/next-app'),
      run: 'static',
    }),
    /** Dogfood typed nextConfig override (env visible in static HTML). */
    nextStaticOverride: next({
      id: 'nextStaticOverride',
      root: join(root, 'fixtures/next-app'),
      run: 'static',
      nextConfig: { env: { UT_MARK: 'override-ok' } },
    }),
    astroSite: astro({
      id: 'astroSite',
      root: join(root, 'fixtures/astro-site'),
      run: 'preview',
    }),
    sveltekitApp: sveltekit({
      id: 'sveltekitApp',
      root: join(root, 'fixtures/sveltekit-app'),
      run: 'preview',
    }),
    /** Dogfood typed kitConfig override (changes kit.appDir in build output). */
    sveltekitKitCfg: sveltekit({
      id: 'sveltekitKitCfg',
      root: join(root, 'fixtures/sveltekit-app'),
      run: 'preview',
      kitConfig: { kit: { appDir: '_app_ut' } },
    }),
    remixApp: remix({
      id: 'remixApp',
      root: join(root, 'fixtures/remix-app'),
      run: 'server',
    }),
    solidApp: solidstart({
      id: 'solidApp',
      root: join(root, 'fixtures/solid-app'),
      run: 'preview',
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
