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
    nextStatic: next({
      id: 'nextStatic',
      root: join(root, 'fixtures/next-app'),
      run: 'static',
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
