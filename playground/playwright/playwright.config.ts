import { createPlaywrightConfig } from 'untestutils/playwright';
import { recipes } from '../recipes.ts';

/**
 * Parallel Playwright dogfood: isolated session + chromium/firefox matrix on
 * the static harness; remote stays chromium-only / skippable.
 */
export default createPlaywrightConfig({
  recipes,
  session: 'playground-pw',
  prewarm: ['staticSite'],
  workers: 2,
  fullyParallel: true,
  testDir: './',
  timeout: 60_000,
  projects: [
    {
      name: 'static-chromium',
      testMatch: /static\.spec\.ts/,
      use: { harness: 'staticSite', browserName: 'chromium' },
    },
    {
      name: 'static-firefox',
      testMatch: /static\.spec\.ts/,
      use: { harness: 'staticSite', browserName: 'firefox' },
    },
    {
      name: 'remote',
      testMatch: /remote\.spec\.ts/,
    },
  ],
});
