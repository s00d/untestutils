import { defineConfig } from '@playwright/test';
import { createPlaywrightConfig } from 'untestutils/playwright';
import { recipes } from './recipes';

export default defineConfig(
  createPlaywrightConfig({
    recipes,
    session: 'app-pw',
    prewarm: ['basic'],
    workers: 2,
    fullyParallel: true,
    testDir: './tests/e2e',
    use: {
      headless: true,
    },
  }),
);
