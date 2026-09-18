import { AsyncLocalStorage } from 'node:async_hooks';
import type { HarnessHandle, Recipe, UseHarnessOptions } from './types';
import { createHarnessHandle, ensurePrepared } from './orchestrator';
import { resolveArtifactsRoot } from './paths';

const storage = new AsyncLocalStorage<HarnessHandle>();
const handles = new Map<string, HarnessHandle>();

export async function useHarness(
  recipe: string | Recipe,
  _opts: UseHarnessOptions = {},
): Promise<HarnessHandle> {
  const prepared = await ensurePrepared(recipe, {
    artifactsRoot: resolveArtifactsRoot(),
  });
  const handle = createHarnessHandle(prepared);
  handles.set(handle.id, handle);
  storage.enterWith(handle);
  return handle;
}

export function getCurrentHarness(): HarnessHandle | undefined {
  return storage.getStore();
}

export function getHarness(id: string): HarnessHandle | undefined {
  return handles.get(id);
}
