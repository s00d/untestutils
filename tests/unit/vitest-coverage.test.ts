import { describe, expect, test } from 'vitest';
import {
  createCoverageConfig,
  DEFAULT_COVERAGE_THRESHOLDS,
  UNTESTUTILS_WORKSPACE_PACKAGES,
  untestutils,
} from '../../packages/vitest/src/plugin';

describe('coverage config', () => {
  test('app defaults', () => {
    const c = createCoverageConfig();
    expect(c.provider).toBe('v8');
    expect(c.include).toEqual(['src/**/*.{ts,tsx,js,jsx,mjs,vue}']);
    expect(c.thresholds).toEqual(DEFAULT_COVERAGE_THRESHOLDS);
    expect(c.exclude).toContain('**/*.test.ts');
  });

  test('workspace packages expand', () => {
    const c = createCoverageConfig({
      workspacePackages: ['core', 'vitest'],
      includeEnvironment: true,
      thresholds: { branches: 60 },
    });
    expect(c.include).toContain('packages/core/src/**/*.{ts,tsx,mjs,js}');
    expect(c.include).toContain('packages/vitest-environment-untestutils/**/*.{mjs,js,ts}');
    expect(c.thresholds.branches).toBe(60);
    expect(c.thresholds.lines).toBe(80);
    expect(UNTESTUTILS_WORKSPACE_PACKAGES).toContain('core');
  });

  test('plugin merges coverage into vitest config', async () => {
    const plugin = untestutils({ coverage: { thresholds: { lines: 90 } } });
    const config: {
      sequence?: { setupFiles?: string };
      globalSetup?: string[];
      setupFiles?: string[];
      coverage?: { thresholds?: { lines?: number }; include?: string[] };
    } = {};
    await plugin.configureVitest?.({
      project: { name: 't', config, provide: () => {} },
      vitest: { config: {}, projects: [] },
      injectTestProjects: async () => [],
    });
    expect(config.coverage?.thresholds?.lines).toBe(90);
    expect(config.coverage?.include?.[0]).toMatch(/^src\//);
  });
});
