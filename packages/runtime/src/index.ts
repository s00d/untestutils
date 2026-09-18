/**
 * v0.2 Nuxt in-process runtime — scaffold.
 * Full mountSuspended / mockNuxtImport ships in v0.2 milestone.
 */

export function mountSuspended(_component: unknown, _options?: unknown): never {
  throw new Error(
    '[untestutils/runtime] mountSuspended is part of v0.2 (Nuxt in-process). Use harness e2e for now.',
  );
}

export function mockNuxtImport(_name: string, _factory: () => unknown): never {
  throw new Error('[untestutils/runtime] mockNuxtImport is part of v0.2');
}

export function registerEndpoint(_path: string, _handler: unknown): never {
  throw new Error('[untestutils/runtime] registerEndpoint is part of v0.2');
}

export function mockComponent(_path: string, _component: unknown): never {
  throw new Error('[untestutils/runtime] mockComponent is part of v0.2');
}
