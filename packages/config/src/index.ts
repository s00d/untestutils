/**
 * untestutils Vitest config helpers (`untestutils/config`).
 *
 * Hybrid port of `@nuxt/test-utils/config`:
 *  - `defineVitestConfig` — wraps a Vitest config so Nuxt-flavoured specs run in
 *    the `untestutils` environment (auto-splitting into projects when needed).
 *  - `defineVitestProject` — defines a single project using the `untestutils`
 *    environment.
 *  - `getVitestConfigFromNuxt` — boots Nuxt and derives the Vite/Vitest config.
 *
 * Supports the `nitroEnvironment` option (via
 * `test.environmentOptions.nuxt.nitroEnvironment`) for server-side unit tests,
 * mirroring upstream.
 */
// The heavy implementation lives in an adapted `.mjs` module so the Nuxt
// virtual/plugin wiring stays byte-compatible with upstream behaviour.
import * as impl from './config.mjs';

export interface NuxtConfigOptions {
  rootDir?: string;
  domEnvironment?: 'happy-dom' | 'jsdom';
  overrides?: Record<string, any>;
  dotenv?: Record<string, any>;
  nitroEnvironment?: boolean;
  [key: string]: any;
}

export interface DefineVitestConfigInput {
  test?: Record<string, any> & {
    environment?: string;
    environmentOptions?: { nuxt?: NuxtConfigOptions; [key: string]: any };
  };
  [key: string]: any;
}

export const defineVitestConfig: (config?: DefineVitestConfigInput) => (...args: any[]) => any = (
  impl as any
).defineVitestConfig;

export const defineVitestProject: (config?: DefineVitestConfigInput) => Promise<any> = (impl as any)
  .defineVitestProject;

export const getVitestConfigFromNuxt: (
  options?: any,
  loadNuxtOptions?: Record<string, any>,
) => Promise<any> = (impl as any).getVitestConfigFromNuxt;
