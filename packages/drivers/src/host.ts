import { defineRecipe, normalizeBaseUrl, waitForHttpReady, type Recipe } from '@untestutils/core';
import { defineDriver } from './define-driver';

export interface HostOptions {
  id: string;
  /** Absolute or env-resolved URL of an already-deployed app (staging/prod). */
  url: string;
  readyPath?: string;
  /** Skip HTTP ready check (default false). */
  skipReady?: boolean;
  share?: Recipe['share'];
}

/**
 * Attach to an already-running remote/staging/prod URL — no local prepare/start.
 * Use for post-deploy smoke with Playwright/Vitest.
 */
export const host = defineDriver((opts: HostOptions): Recipe => {
  const url = normalizeBaseUrl(opts.url);
  return defineRecipe({
    id: opts.id,
    share: opts.share ?? 'always',
    ...(opts.skipReady ? { ready: async () => {} } : {}),
    start: async () => {
      if (!opts.skipReady) {
        await waitForHttpReady(url, { path: opts.readyPath ?? '/' });
      }
      return {
        kind: 'url',
        url,
        stop: async () => {
          /* remote process is not ours */
        },
      };
    },
  });
});

export default host;
