import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  isCi,
  isProgressEnabled,
  isQuiet,
  progress,
  progressIo,
  withQuietLogger,
} from '../../packages/core/src/progress';

describe('progress', () => {
  beforeEach(() => {
    progressIo.reset();
    progressIo.capture = true;
    delete process.env.UNTESTUTILS_QUIET;
    delete process.env.UNTESTUTILS_PROGRESS;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
  });

  afterEach(() => {
    progressIo.reset();
    delete process.env.UNTESTUTILS_QUIET;
    delete process.env.UNTESTUTILS_PROGRESS;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.UNTESTUTILS_DEBUG;
  });

  test('formats prepare / cache / start / teardown lines', () => {
    progress.prepareStart('async-components');
    progress.prepareDone('async-components', 6500);
    progress.prepareCache('redirect');
    progress.start('redirect', 'http://127.0.0.1:61240');
    progress.teardown();

    const text = progressIo.lines.join('\n');
    expect(text).toMatch(/untestutils/);
    expect(text).toMatch(/prepare\s+async-components\s+building/);
    expect(text).toMatch(/prepare\s+async-components\s+6\.5s/);
    expect(text).toMatch(/prepare\s+redirect\s+cache/);
    expect(text).toMatch(/start\s+redirect\s+http:\/\/127\.0\.0\.1:61240/);
    expect(text).toMatch(/teardown/);
  });

  test('quiet / PROGRESS=0 suppress status but fail still records', () => {
    process.env.UNTESTUTILS_QUIET = '1';
    expect(isQuiet()).toBe(true);
    expect(isProgressEnabled()).toBe(false);
    progress.prepareStart('x');
    progress.start('x', 'http://127.0.0.1:1');
    expect(progressIo.lines).toEqual([]);

    progress.fail('x', new Error('boom'));
    expect(progressIo.lines.some((l) => l.includes('fail') && l.includes('boom'))).toBe(true);
  });

  test('CI disables progress unless UNTESTUTILS_PROGRESS=1', () => {
    process.env.CI = 'true';
    expect(isCi()).toBe(true);
    expect(isProgressEnabled()).toBe(false);
    progress.prepareStart('ci');
    expect(progressIo.lines).toEqual([]);

    process.env.UNTESTUTILS_PROGRESS = '1';
    expect(isProgressEnabled()).toBe(true);
    progress.prepareCache('ci');
    expect(progressIo.lines.some((l) => l.includes('cache'))).toBe(true);
  });

  test('GITHUB_ACTIONS counts as CI', () => {
    process.env.GITHUB_ACTIONS = 'true';
    expect(isCi()).toBe(true);
    expect(isProgressEnabled()).toBe(false);
  });

  test('fail always records message', () => {
    progress.fail('broken', new Error('boom'));
    expect(progressIo.lines.some((l) => l.includes('fail') && l.includes('boom'))).toBe(true);
  });

  test('withQuietLogger no-ops when progress disabled (CI)', async () => {
    process.env.CI = '1';
    const { consola } = await import('consola');
    const prev = consola.level;
    consola.level = 3;
    await withQuietLogger(async () => {
      expect(consola.level).toBe(3);
    });
    expect(consola.level).toBe(3);
    consola.level = prev;
  });

  test('withQuietLogger keeps error level and restores; rethrows', async () => {
    process.env.UNTESTUTILS_PROGRESS = '1';
    delete process.env.CI;
    const { consola, LogLevels } = await import('consola');
    const prev = consola.level;
    consola.level = 3;
    await withQuietLogger(async () => {
      expect(consola.level).toBe(LogLevels.error);
    });
    expect(consola.level).toBe(3);

    await expect(
      withQuietLogger(async () => {
        throw new Error('prepare failed');
      }),
    ).rejects.toThrow('prepare failed');
    expect(consola.level).toBe(3);
    consola.level = prev;
  });
});
