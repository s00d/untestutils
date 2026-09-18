import { defineRecipes, staticDir, host } from 'untestutils';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

const root = dirname(fileURLToPath(import.meta.url));

const remoteUrl = process.env.UNTESTUTILS_REMOTE_URL;

export const recipes = defineRecipes({
  staticSite: staticDir({
    id: 'staticSite',
    root: join(root, 'fixtures/static-site'),
  }),
  ...(remoteUrl
    ? {
        remote: host({
          id: 'remote',
          url: remoteUrl,
        }),
      }
    : {}),
}, import.meta.url);
