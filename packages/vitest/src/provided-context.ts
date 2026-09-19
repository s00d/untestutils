/**
 * Serializable harness session passed via Vitest `provide` / `inject`.
 * Env vars remain a fallback for Playwright Test and CLI.
 */
export interface UntestutilsProvidedSession {
  recipesModule?: string;
  artifactsRoot: string;
  session?: string;
  browsers: Array<'chromium' | 'firefox' | 'webkit'>;
  /** Recipe id → live URL after globalSetup prewarm / registry apply. */
  urls: Record<string, string>;
}

declare module 'vitest' {
  interface ProvidedContext {
    untestutils: UntestutilsProvidedSession;
    untestutilsBrowser: 'chromium' | 'firefox' | 'webkit';
  }
}

/** Side-effect anchor so the `vitest` module augmentation is retained at runtime. */
export const providedContextAugmentation = true;
