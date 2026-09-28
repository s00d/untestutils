const WORKER_STATE_PROP = '__UNTESTUTILS_WORKER_STATE__' as const;

type WorkerStateBag = Map<string, unknown>;

type WorkerStateWindow = Window & {
  [WORKER_STATE_PROP]?: WorkerStateBag;
};

/**
 * Lazy singleton bound to the environment window — survives module re-eval between files.
 */
export function getOrCreateWorkerState<T>(
  name: string,
  create: () => T,
  win: Window = typeof window !== 'undefined' ? window : (undefined as unknown as Window),
): T {
  if (!win) return create();
  const w = win as WorkerStateWindow;
  const bag = (w[WORKER_STATE_PROP] ??= new Map());
  if (!bag.has(name)) bag.set(name, create());
  return bag.get(name) as T;
}
