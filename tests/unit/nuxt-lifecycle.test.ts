/** @vitest-environment happy-dom */
import { describe, expect, test, vi } from 'vitest';
import {
  addCleanup,
  cleanupAll,
  removeCleanup,
} from '../../packages/nuxt/src/runtime/shared/cleanup';
import {
  disposeSharedNuxtApp,
  invalidateWorkerNuxtSetup,
  type SetupEntryWindow,
} from '../../packages/nuxt/src/runtime/shared/setup-entry';

describe('cleanupAll resilience', () => {
  test('runs later cleanups even if one throws', () => {
    const second = vi.fn();
    addCleanup(() => {
      throw new Error('first boom');
    });
    addCleanup(second);
    expect(() => cleanupAll()).toThrow('first boom');
    expect(second).toHaveBeenCalledTimes(1);
    cleanupAll();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('removeCleanup prevents execution', () => {
    const spy = vi.fn();
    addCleanup(spy);
    removeCleanup(spy);
    cleanupAll();
    expect(spy).not.toHaveBeenCalled();
  });

  test('AggregateError when multiple cleanups throw', () => {
    addCleanup(() => {
      throw new Error('a');
    });
    addCleanup(() => {
      throw new Error('b');
    });
    expect(() => cleanupAll()).toThrow(AggregateError);
  });
});

describe('disposeSharedNuxtApp', () => {
  test('stops scope, unmounts, clears root, never throws', async () => {
    const stop = vi.fn();
    const unmount = vi.fn(() => {
      throw new Error('unmount boom');
    });
    document.body.innerHTML = '<div id="nuxt-test"><span>x</span></div>';
    await disposeSharedNuxtApp(() => ({
      vueApp: { unmount },
      _scope: { stop },
    }));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(document.getElementById('nuxt-test')?.innerHTML).toBe('');
  });

  test('no-op when no app', async () => {
    await expect(disposeSharedNuxtApp(() => null)).resolves.toBeUndefined();
  });
});

describe('invalidateWorkerNuxtSetup', () => {
  test('clears memo and baselines', () => {
    const win = {
      __UNTESTUTILS_WORKER_SETUP__: Promise.resolve(),
      __UNTESTUTILS_WORKER_RESET_HOOK__: true,
      __UNTESTUTILS_BASELINE_ROUTE__: '/x',
      __UNTESTUTILS_BASELINE_BODY__: new Set(),
    } as SetupEntryWindow & {
      __UNTESTUTILS_BASELINE_ROUTE__?: string;
      __UNTESTUTILS_BASELINE_BODY__?: Set<Element>;
    };
    invalidateWorkerNuxtSetup(win);
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
    expect(win.__UNTESTUTILS_WORKER_RESET_HOOK__).toBeUndefined();
    expect(win.__UNTESTUTILS_BASELINE_ROUTE__).toBeUndefined();
    expect(win.__UNTESTUTILS_BASELINE_BODY__).toBeUndefined();
  });
});
