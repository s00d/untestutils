import { describe, test, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { applyPreset, peersForPreset } from '../../packages/cli/src/utils/templates';
import { findMonorepoRoot } from '../../packages/cli/src/utils/workspace';

describe('cli templates', () => {
  test('peersForPreset covers presets', () => {
    expect(peersForPreset('vitest')).toContain('vitest');
    expect(peersForPreset('playwright')).toContain('@playwright/test');
    expect(peersForPreset('nuxt')).toContain('nuxt');
    expect(peersForPreset('full')).toEqual(
      expect.arrayContaining(['vitest', '@playwright/test', 'nuxt']),
    );
  });

  test('applyPreset vitest writes configs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'untestutils-init-'));
    try {
      const written = await applyPreset(dir, 'vitest', { force: true });
      expect(written.length).toBeGreaterThan(0);
      const cfg = await readFile(join(dir, 'vitest.config.ts'), 'utf8');
      expect(cfg).toContain('untestutils/vitest/plugin');
      const smoke = await readFile(join(dir, 'tests/e2e/smoke.test.ts'), 'utf8');
      expect(smoke).toContain('useHarness');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('findMonorepoRoot finds this repo', () => {
    const root = findMonorepoRoot();
    expect(root).toBeTruthy();
    expect(root).toContain('untestutils');
  });
});
