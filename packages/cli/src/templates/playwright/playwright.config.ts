import { defineConfig } from '@playwright/test';
import { createPlaywrightConfig } from 'untestutils/playwright';
import { recipes } from './recipes';

export default defineConfig(
  createPlaywrightConfig({
    recipes,
    prewarm: ['basic'],
    testDir: './tests/e2e',
    use: {
      headless: true,
    },
  }),
);
