import { createPlaywrightConfig } from 'untestutils/playwright';
import { recipes } from '../recipes.ts';

/**
 * Parallel Playwright dogfood with an isolated session root so teardown
 * does not kill Vitest / other PW runs sharing the repo `.untestutils`.
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
      name: 'static',
      testMatch: /static\.spec\.ts/,
      use: { harness: 'staticSite' },
    },
    {
      name: 'remote',
      testMatch: /remote\.spec\.ts/,
    },
  ],
});
