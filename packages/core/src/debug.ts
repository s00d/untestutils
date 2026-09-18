const PREFIX = '[untestutils';

export function isDebug(): boolean {
  return process.env.UNTESTUTILS_DEBUG === '1' || process.env.UNTESTUTILS_DEBUG === 'true';
}

export function debug(scope: string, message: string, extra?: unknown): void {
  if (!isDebug()) return;
  // stderr is fine for opt-in debug noise
  if (extra !== undefined) {
    console.error(`${PREFIX}:${scope}] ${message}`, extra);
  } else {
    console.error(`${PREFIX}:${scope}] ${message}`);
  }
}

/** Non-lifecycle messages — stdout so Vitest does not label as [error]. */
export function log(scope: string, message: string): void {
  console.log(`${PREFIX}:${scope}] ${message}`);
}

export function envFlag(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return v === '1' || v === 'true';
}
