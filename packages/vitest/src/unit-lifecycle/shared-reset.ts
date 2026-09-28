type ResetFn = () => void | Promise<void>;

type SharedResetEntry = { key: string; fn: ResetFn };

type SharedResetWindow = Window & {
  __UNTESTUTILS_SHARED_RESETS__?: SharedResetEntry[];
};

function asWin(win: Window): SharedResetWindow {
  return win as SharedResetWindow;
}

/**
 * Register a keyed soft-reset callback that survives setupFile re-evals.
 * Same `key` replaces in place (order preserved). Returns unregister.
 */
export function registerSharedReset(
  key: string,
  fn: ResetFn,
  win: Window = typeof window !== 'undefined' ? window : (undefined as unknown as Window),
): () => void {
  if (!win) return () => {};
  const w = asWin(win);
  const list = (w.__UNTESTUTILS_SHARED_RESETS__ ??= []);
  const existing = list.findIndex((entry) => entry.key === key);
  if (existing !== -1) list[existing] = { key, fn };
  else list.push({ key, fn });
  return () => {
    const index = list.findIndex((entry) => entry.key === key);
    if (index !== -1) list.splice(index, 1);
  };
}

/** Run all keyed shared resets; continue after throws; AggregateError at end. */
export async function runSharedResets(
  win: Window = typeof window !== 'undefined' ? window : (undefined as unknown as Window),
): Promise<void> {
  if (!win) return;
  const list = [...(asWin(win).__UNTESTUTILS_SHARED_RESETS__ ?? [])];
  const errors: unknown[] = [];
  for (const entry of list) {
    try {
      await entry.fn();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, '[untestutils] runSharedResets: multiple reset failures');
  }
}
