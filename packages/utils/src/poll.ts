export type PollUntilOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  message?: string;
};

/** Poll until `check` returns true or the deadline is reached. */
export async function pollUntil(
  check: () => boolean | Promise<boolean>,
  options: PollUntilOptions = {},
): Promise<void> {
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + (options.timeoutMs ?? 20_000);

  for (;;) {
    if (await check()) return;
    if (Date.now() >= deadline) {
      throw new Error(options.message ?? 'Timed out while polling');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Run async callbacks one after another (shared Playwright page, etc.). */
export async function runSequential<T>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let i = 0;
  for (const item of items) {
    await fn(item, i++);
  }
}
