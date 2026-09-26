export type UnitFrameworkId =
  | 'nuxt'
  | 'vite'
  | 'next'
  | 'astro'
  | 'sveltekit'
  | 'remix'
  | 'solidstart';

export const UNIT_FRAMEWORK_PACKAGES: Record<UnitFrameworkId, string> = {
  nuxt: '@untestutils/nuxt/environment',
  vite: '@untestutils/vite/environment',
  next: '@untestutils/next/environment',
  astro: '@untestutils/astro/environment',
  sveltekit: '@untestutils/sveltekit/environment',
  remix: '@untestutils/remix/environment',
  solidstart: '@untestutils/solidstart/environment',
};

export const UNIT_FRAMEWORK_IDS = Object.keys(UNIT_FRAMEWORK_PACKAGES) as UnitFrameworkId[];

export type ResolveUnitFrameworkOptions = {
  untestutils?: { framework?: string; [key: string]: unknown };
  nuxt?: unknown;
  nuxtRuntimeConfig?: unknown;
  [key: string]: unknown;
};

/**
 * Resolve unit framework from Vitest `environmentOptions`.
 * Priority:
 * 1. `untestutils.framework`
 * 2. Exactly one top-level key among known frameworks (`vite`, `next`, …)
 * 3. Legacy `nuxt` / `nuxtRuntimeConfig` → `nuxt`
 * 4. Default `nuxt`
 */
export function resolveUnitFramework(options: ResolveUnitFrameworkOptions = {}): UnitFrameworkId {
  const raw = options.untestutils?.framework;
  if (typeof raw === 'string' && raw.trim()) {
    const id = raw.trim().toLowerCase() as UnitFrameworkId;
    if (!(id in UNIT_FRAMEWORK_PACKAGES)) {
      throw new Error(
        `[untestutils] unknown unit framework "${raw}". Supported: ${UNIT_FRAMEWORK_IDS.join(', ')}`,
      );
    }
    return id;
  }

  const topLevel = UNIT_FRAMEWORK_IDS.filter(
    (id) => options[id] !== null && options[id] !== undefined,
  );
  if (topLevel.length > 1) {
    throw new Error(
      `[untestutils] ambiguous environmentOptions — set untestutils.framework or only one of: ${topLevel.join(', ')}`,
    );
  }
  if (topLevel.length === 1) return topLevel[0]!;

  if (
    (options.nuxt !== null && options.nuxt !== undefined) ||
    (options.nuxtRuntimeConfig !== null && options.nuxtRuntimeConfig !== undefined)
  )
    return 'nuxt';
  return 'nuxt';
}
