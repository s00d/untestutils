import { createPlaywrightConfig } from 'untestutils/playwright';
import { recipes } from '../recipes.ts';

export default createPlaywrightConfig({
  recipes,
  prewarm: ['staticSite'],
  testDir: './',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
});
