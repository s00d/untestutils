import { describe, expect, test, vi } from 'vitest';
import {
  mountSuspended,
  mockNuxtImport,
  registerEndpoint,
  mockComponent,
} from '@untestutils/runtime';
import untestutilsModule from '@untestutils/module';
import { defineVitestConfig, defineVitestProject } from '@untestutils/config';

describe('runtime stubs', () => {
  test('all APIs throw v0.2', () => {
    expect(() => mountSuspended({})).toThrow(/v0\.2/);
    expect(() => mockNuxtImport('x', () => ({}))).toThrow(/v0\.2/);
    expect(() => registerEndpoint('/', () => {})).toThrow(/v0\.2/);
    expect(() => mockComponent('x', {})).toThrow(/v0\.2/);
  });
});

describe('module stub', () => {
  test('returns named module and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = untestutilsModule();
    expect(mod.name).toBe('untestutils');
    expect(() => mod.setup()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('config stubs', () => {
  test('defineVitestConfig / Project throw', async () => {
    await expect(defineVitestConfig()).rejects.toThrow(/v0\.2/);
    await expect(defineVitestProject()).rejects.toThrow(/v0\.2/);
  });
});
