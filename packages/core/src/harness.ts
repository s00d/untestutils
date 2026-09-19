import { AsyncLocalStorage } from 'node:async_hooks';
import type { HarnessHandle, Recipe, UseHarnessOptions } from './types';
import {
  createHarnessHandle,
  ensurePrepared,
  type OrchestratorOptions,
  type PreparedTarget,
} from './orchestrator';
import { resolveArtifactsRoot } from './paths';

const storage = new AsyncLocalStorage<HarnessHandle>();
const handles = new Map<string, HarnessHandle>();

export type LeaseOptions = OrchestratorOptions & UseHarnessOptions;

export interface LeasedTarget extends HarnessHandle {
  /** Drop this process's handle bookkeeping. Does not stop shared recipe servers. */
  release: () => Promise<void>;
}

function artifactsFrom(opts: LeaseOptions): string {
  return opts.artifactsRoot ?? resolveArtifactsRoot(opts.cwd);
}

export async function prepareOnce(
  recipe: string | Recipe,
  opts: LeaseOptions = {},
): Promise<PreparedTarget> {
  return ensurePrepared(recipe, {
    artifactsRoot: artifactsFrom(opts),
    cwd: opts.cwd,
  });
}

/**
 * Prepare/start a recipe and return a handle with explicit `release`.
 * Prefer this over `useHarness` when you need RAII-style cleanup bookkeeping.
 */
export async function leaseTarget(
  recipe: string | Recipe,
  opts: LeaseOptions = {},
): Promise<LeasedTarget> {
  const prepared = await prepareOnce(recipe, opts);
  const handle = createHarnessHandle(prepared);
  handles.set(handle.id, handle);
  storage.enterWith(handle);
  return {
    ...handle,
    release: async () => {
      handles.delete(handle.id);
    },
  };
}

/** Lease a target, run `fn`, always `release` afterward. */
export async function withHarness<T>(
  recipe: string | Recipe,
  fn: (handle: HarnessHandle) => Promise<T>,
  opts: LeaseOptions = {},
): Promise<T> {
  const leased = await leaseTarget(recipe, opts);
  try {
    return await fn(leased);
  } finally {
    await leased.release();
  }
}

export async function useHarness(
  recipe: string | Recipe,
  opts: UseHarnessOptions = {},
): Promise<HarnessHandle> {
  const leased = await leaseTarget(recipe, opts);
  return leased;
}

export function getCurrentHarness(): HarnessHandle | undefined {
  return storage.getStore();
}

export function getHarness(id: string): HarnessHandle | undefined {
  return handles.get(id);
}
