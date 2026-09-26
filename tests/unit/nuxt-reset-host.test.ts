/** @vitest-environment happy-dom */
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  clearNuxtImportMocks,
  clearRegisteredEndpoints,
  registerSharedNuxtReset,
  resetSharedNuxtApp,
} from '../../packages/nuxt/src/runtime/shared/reset';

const HOIST = '__NUXT_VITEST_MOCKS';
const FNS = '__NUXT_VITEST_MOCK_FNS';
const ORIGINAL = '__NUXT_VITEST_MOCKS_ORIGINAL';

describe('clearNuxtImportMocks', () => {
  test('restores originals and clears factories', () => {
    const g = globalThis as Record<string, unknown>;
    g[HOIST] = {
      '#imports': {
        useFoo: 'mocked',
        [ORIGINAL]: { useFoo: 'original' },
      },
    };
    g[FNS] = { '#imports': { useFoo: () => 'mocked' } };

    clearNuxtImportMocks();

    expect((g[HOIST] as Record<string, Record<string, unknown>>)['#imports']!.useFoo).toBe(
      'original',
    );
    expect(g[FNS]).toEqual({});
  });
});

describe('resetSharedNuxtApp host layers', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="nuxt-test"></div><div id="teleports"></div>';
    const baseline = new Set([...document.body.children]);
    (
      window as unknown as { __UNTESTUTILS_BASELINE_BODY__?: Set<Element> }
    ).__UNTESTUTILS_BASELINE_BODY__ = baseline;
    (
      window as unknown as { __UNTESTUTILS_BASELINE_ROUTE__?: string }
    ).__UNTESTUTILS_BASELINE_ROUTE__ = '/';
    localStorage.setItem('x', '1');
    sessionStorage.setItem('y', '2');
    document.cookie = 'tok=abc; path=/';
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('clears storage and cookies by default', async () => {
    await resetSharedNuxtApp();
    expect(localStorage.getItem('x')).toBeNull();
    expect(sessionStorage.getItem('y')).toBeNull();
    expect(document.cookie.includes('tok=')).toBe(false);
  });

  test('host: false leaves storage', async () => {
    await resetSharedNuxtApp({ host: false, timers: false, stubs: false });
    expect(localStorage.getItem('x')).toBe('1');
    expect(sessionStorage.getItem('y')).toBe('2');
  });

  test('clears registered endpoints', async () => {
    (
      window as unknown as { __app?: { _registeredEndpointRegistry: Record<string, unknown[]> } }
    ).__app = {
      _registeredEndpointRegistry: { '/x': [{}] },
    };
    (window as unknown as { __registry?: Set<string> }).__registry = new Set(['/x']);
    clearRegisteredEndpoints();
    expect(
      (window as unknown as { __app: { _registeredEndpointRegistry: Record<string, unknown[]> } })
        .__app._registeredEndpointRegistry,
    ).toEqual({});
  });

  test('runs registerSharedNuxtReset callbacks', async () => {
    const spy = vi.fn();
    const dispose = registerSharedNuxtReset(spy);
    await resetSharedNuxtApp({ host: false, timers: false, stubs: false });
    expect(spy).toHaveBeenCalledTimes(1);
    dispose();
  });

  test('prunes body children outside baseline', async () => {
    const junk = document.createElement('div');
    junk.id = 'junk';
    document.body.appendChild(junk);
    await resetSharedNuxtApp({ host: false, timers: false, stubs: false });
    expect(document.getElementById('junk')).toBeNull();
    expect(document.getElementById('nuxt-test')).not.toBeNull();
  });

  test('clears fake timers by default', async () => {
    vi.useFakeTimers();
    await resetSharedNuxtApp({ host: false, stubs: false });
    expect(vi.isFakeTimers()).toBe(false);
  });

  test('timers: false leaves fake timers', async () => {
    vi.useFakeTimers();
    await resetSharedNuxtApp({ host: false, timers: false, stubs: false });
    expect(vi.isFakeTimers()).toBe(true);
    vi.useRealTimers();
  });

  test('unstubs env by default', async () => {
    vi.stubEnv('UT_RESET_STUB', '1');
    await resetSharedNuxtApp({ host: false, timers: false });
    expect(process.env.UT_RESET_STUB).toBeUndefined();
  });
});
