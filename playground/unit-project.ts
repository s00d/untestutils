import type { InlineConfig } from 'vitest/node';

export type MarkerUnitProjectKind = 'marker' | 'file' | 'worker';

export type MarkerUnitProjectInput = {
  framework: string;
  kind: MarkerUnitProjectKind;
  /** Vitest project name; default `unit-${framework}` (+ kind suffix except marker). */
  name?: string;
  include?: string[];
};

/**
 * Shared playground vitest project shape for marker unit-env packages.
 * Callers still wrap with the framework's `defineVitestProject`.
 */
export function markerUnitProjectOptions(input: MarkerUnitProjectInput): {
  test: InlineConfig & Record<string, unknown>;
} {
  const { framework, kind } = input;
  const dir = `unit-${framework}`;
  const name =
    input.name ??
    (kind === 'marker' ? `unit-${framework}` : `unit-${framework}-${kind}`);

  if (kind === 'marker') {
    return {
      test: {
        name,
        include: input.include ?? [`${dir}/marker.spec.ts`],
        environmentOptions: {
          untestutils: {
            domEnvironment: 'happy-dom',
          },
        },
      },
    };
  }

  if (kind === 'file') {
    return {
      test: {
        name,
        include: input.include ?? [`${dir}/a.spec.ts`, `${dir}/b.spec.ts`],
        maxWorkers: 1,
        environmentOptions: {
          untestutils: {
            domEnvironment: 'happy-dom',
            appIsolation: 'file',
          },
        },
      },
    };
  }

  return {
    test: {
      name,
      include: input.include ?? [`${dir}/a.spec.ts`, `${dir}/b.spec.ts`],
      maxWorkers: 1,
      pool: 'threads',
      environmentOptions: {
        untestutils: {
          domEnvironment: 'happy-dom',
          appIsolation: 'worker',
          resetBetweenTests: true,
        },
      },
    },
  };
}
