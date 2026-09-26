type Cleanup = () => void;

type CleanupWindow = Window & { __cleanup?: Cleanup[] };

/** Drain registered cleanups; later entries still run if earlier ones throw. */
export function cleanupAll(win: Window = window): void {
  const w = win as CleanupWindow;
  const list = (w.__cleanup || []).splice(0);
  const errors: unknown[] = [];
  for (const fn of list) {
    try {
      fn();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, '[untestutils] cleanupAll: multiple cleanup failures');
  }
}

export function addCleanup(fn: Cleanup, win: Window = window): void {
  const w = win as CleanupWindow;
  w.__cleanup ||= [];
  w.__cleanup.push(fn);
}

export function removeCleanup(fn: Cleanup, win: Window = window): void {
  const w = win as CleanupWindow;
  const index = w.__cleanup?.indexOf(fn) ?? -1;
  if (index !== -1) w.__cleanup?.splice(index, 1);
}
