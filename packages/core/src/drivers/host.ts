import { defineRecipe } from '../recipes';
import { normalizeBaseUrl } from '../paths';
import { waitForHttpReady } from '../ready';
import type { Recipe } from '../types';
import { defineDriver, type Driver } from './define-driver';

export interface HostOptions {
  id: string;
  /** Absolute or env-resolved URL of an already-deployed app (staging/prod). */
  url: string;
  readyPath?: string;
  readyTimeoutMs?: number;
  /** Skip HTTP ready check (default false). */
  skipReady?: boolean;
  share?: Recipe['share'];
}

/**
 * Attach to an already-running remote/staging/prod URL — no local prepare/start.
 * Use for post-deploy smoke with Playwright/Vitest.
 */
export const host: Driver<HostOptions> = defineDriver((opts: HostOptions): Recipe => {
  if (!opts.url?.trim()) {
    throw new Error('[untestutils/host] url is required');
  }
  const url = normalizeBaseUrl(opts.url);
  return defineRecipe({
    id: opts.id,
    share: opts.share ?? 'always',
    // Probe runs in start — noop so orchestrator does not wait twice.
    ready: async () => {},
    start: async () => {
      if (!opts.skipReady) {
        await waitForHttpReady(url, {
          path: opts.readyPath ?? '/',
          timeoutMs: opts.readyTimeoutMs,
        });
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
