import { getOrCreateWorkerState } from '@untestutils/vitest/unit-lifecycle';

type Impl = (...args: unknown[]) => unknown;

type OverrideEntry = {
  wrapper: Impl;
  current: Impl | undefined;
  fallback: Impl | undefined;
};

type OverrideBag = Map<string, OverrideEntry>;

/** Augment in the consuming project to type `overridableNuxtImport` / `overrideNuxtImport`. */
export interface TestNuxtImports {
  [name: string]: unknown;
}

const BAG = 'nuxt-import-overrides';

function bag(win?: Window): OverrideBag {
  return getOrCreateWorkerState(BAG, () => new Map<string, OverrideEntry>(), win);
}

/**
 * Install one stable wrapper per worker for `mockNuxtImport(name, factory)`.
 * Re-eval returns the same wrapper the running app already holds.
 */
export function overridableNuxtImport<K extends keyof TestNuxtImports & string>(
  name: K,
  fallback?: TestNuxtImports[K] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : Impl,
): () => Impl {
  return () => {
    const map = bag();
    let entry = map.get(name);
    if (!entry) {
      const fb = fallback as Impl | undefined;
      entry = {
        fallback: fb,
        current: undefined,
        wrapper: (...args: unknown[]) => {
          const impl = entry!.current ?? entry!.fallback;
          if (!impl) {
            throw new Error(
              `[untestutils] overridableNuxtImport("${name}"): no override and no fallback`,
            );
          }
          return impl(...args);
        },
      };
      map.set(name, entry);
    } else if (fallback !== undefined) {
      entry.fallback = fallback as Impl;
    }
    return entry.wrapper;
  };
}

/**
 * Swap the implementation for the current test. Throws if no wrapper was installed.
 * Returns a disposer that clears the override (also safe in `afterEach`).
 */
export function overrideNuxtImport<K extends keyof TestNuxtImports & string>(
  name: K,
  impl: TestNuxtImports[K] extends (...args: infer A) => infer R ? (...args: A) => R : Impl,
): () => void {
  const entry = bag().get(name);
  if (!entry) {
    throw new Error(
      `[untestutils] overrideNuxtImport("${name}"): no wrapper — call mockNuxtImport(name, overridableNuxtImport("${name}")) in a worker setup file first`,
    );
  }
  entry.current = impl as Impl;
  return () => {
    if (entry.current === impl) entry.current = undefined;
  };
}

type PartialRoute = Record<string, unknown>;

/**
 * `useRoute` wrapper returns `route` for the current test without navigating the real router.
 * Requires `mockNuxtImport('useRoute', overridableNuxtImport('useRoute', original))`.
 */
export function overrideNuxtRoute(route: PartialRoute): () => void {
  return overrideNuxtImport('useRoute' as keyof TestNuxtImports & string, (() => route) as never);
}

/** Clear all current overrides (keeps wrappers). Used by soft reset when `{ mocks: true }`-adjacent. */
export function clearNuxtImportOverrides(win?: Window): void {
  for (const entry of bag(win).values()) {
    entry.current = undefined;
  }
}
