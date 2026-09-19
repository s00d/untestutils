import { describe, expect, test } from 'vitest';
import {
  mountSuspended,
  renderSuspended,
  registerEndpoint,
  mockNuxtImport,
  unmockNuxtImport,
  mockComponent,
} from '@untestutils/nuxt/runtime';
import untestutilsModule from '@untestutils/nuxt/module';
import {
  defineVitestConfig,
  defineVitestProject,
  getVitestConfigFromNuxt,
} from '@untestutils/nuxt/config';

describe('runtime API surface', () => {
  test('all helpers are exported as functions', () => {
    for (const fn of [
      mountSuspended,
      renderSuspended,
      registerEndpoint,
      mockNuxtImport,
      unmockNuxtImport,
      mockComponent,
    ]) {
      expect(typeof fn).toBe('function');
    }
  });

  test('mock macros throw when not transpiled by the module', () => {
    expect(() => mockNuxtImport('useFoo', () => () => 1)).toThrow(/macro/);
    expect(() => unmockNuxtImport('useFoo')).toThrow(/macro/);
    expect(() => mockComponent('MyComponent', {})).toThrow(/macro/);
  });

  test('registerEndpoint requires the untestutils runtime environment', () => {
    expect(() => registerEndpoint('/api/test', () => ({}))).toThrow(/runtime environment/);
  });
});

describe('module', () => {
  test('is a Nuxt module named untestutils', () => {
    expect(typeof untestutilsModule).toBe('function');
    // `defineNuxtModule` attaches metadata accessors.
    const meta = (untestutilsModule as any).getMeta
      ? (untestutilsModule as any).getMeta()
      : undefined;
    if (meta && typeof (meta as any).then === 'function') {
      // getMeta may be async depending on kit version — resolved lazily below.
      return (meta as Promise<any>).then((m) => expect(m.name).toBe('untestutils'));
    }
    if (meta) expect(meta.name).toBe('untestutils');
  });
});

describe('config API surface', () => {
  test('exposes define/get helpers', () => {
    expect(typeof defineVitestConfig).toBe('function');
    expect(typeof defineVitestProject).toBe('function');
    expect(typeof getVitestConfigFromNuxt).toBe('function');
  });

  test('defineVitestConfig returns a lazy config factory (no Nuxt boot)', () => {
    // Should not throw or boot Nuxt just by defining the config.
    const factory = defineVitestConfig({ test: {} });
    expect(typeof factory).toBe('function');
  });
});
