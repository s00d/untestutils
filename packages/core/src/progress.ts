import { envFlag, isDebug } from './debug';

const PHASE_WIDTH = 8;
const ID_WIDTH = 24;

/** Common CI / non-interactive runners (GitHub, GitLab, Jenkins, …). */
export function isCi(): boolean {
  if (envFlag('CI', false)) return true;
  const keys = [
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'CIRCLECI',
    'BUILDKITE',
    'TF_BUILD',
    'TEAMCITY_VERSION',
    'JENKINS_URL',
  ];
  return keys.some((k) => {
    const v = process.env[k];
    return v !== undefined && v !== '' && v !== '0' && v !== 'false';
  });
}

/**
 * Compact harness progress (prepare/start banner).
 * Off when: `UNTESTUTILS_QUIET=1`, `UNTESTUTILS_PROGRESS=0`, or CI (unless `UNTESTUTILS_PROGRESS=1`).
 */
export function isProgressEnabled(): boolean {
  if (envFlag('UNTESTUTILS_QUIET', false)) return false;
  const explicit = process.env.UNTESTUTILS_PROGRESS;
  if (explicit === '0' || explicit === 'false') return false;
  if (explicit === '1' || explicit === 'true') return true;
  if (isCi()) return false;
  return true;
}

/** @deprecated prefer isProgressEnabled — QUIET alone */
export function isQuiet(): boolean {
  return !isProgressEnabled();
}

function useFancy(): boolean {
  if (!isProgressEnabled()) return false;
  if (isCi()) return false;
  return process.stdout.isTTY === true;
}

/** @internal mutable seam for unit tests */
export const progressIo = {
  lines: [] as string[],
  capture: false,
  bannerShown: false,
  write(line: string) {
    process.stdout.write(`${line}\n`);
  },
  writeErr(line: string) {
    process.stderr.write(`${line}\n`);
  },
  reset() {
    this.lines = [];
    this.capture = false;
    this.bannerShown = false;
  },
};

function pad(s: string, width: number): string {
  if (s.length > width) return `${s.slice(0, width - 1)}…`;
  return s.padEnd(width);
}

function formatLine(symbol: string, phase: string, id: string, detail: string): string {
  return `${symbol} ${pad(phase, PHASE_WIDTH)}  ${pad(id, ID_WIDTH)}  ${detail}`;
}

function emit(line: string): void {
  if (!isProgressEnabled()) return;
  if (progressIo.capture) {
    progressIo.lines.push(line);
    return;
  }
  progressIo.write(line);
}

function ensureBanner(): void {
  if (progressIo.bannerShown || !isProgressEnabled()) return;
  progressIo.bannerShown = true;
  emit(useFancy() ? '◆ untestutils' : '[untestutils]');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export const progress = {
  prewarm(ids: string[]): void {
    ensureBanner();
    emit(formatLine('◇', 'prewarm', ids.length ? ids.join(',') : '—', 'starting'));
  },

  prepareStart(id: string): void {
    ensureBanner();
    emit(formatLine(useFancy() ? '●' : '*', 'prepare', id, 'building…'));
  },

  prepareDone(id: string, ms: number): void {
    ensureBanner();
    emit(formatLine(useFancy() ? '✔' : '+', 'prepare', id, formatDuration(ms)));
  },

  prepareCache(id: string): void {
    ensureBanner();
    emit(formatLine(useFancy() ? '✔' : '+', 'prepare', id, 'cache'));
  },

  start(id: string, url: string): void {
    ensureBanner();
    emit(formatLine(useFancy() ? '→' : '>', 'start', id, url));
  },

  teardown(): void {
    ensureBanner();
    emit(formatLine(useFancy() ? '■' : '=', 'teardown', '—', 'stop'));
  },

  /** Always surfaces failures — never swallowed by quiet/CI. */
  fail(id: string, err: unknown): void {
    const line = formatLine(useFancy() ? '✖' : 'x', 'fail', id, errMessage(err));
    if (progressIo.capture) {
      progressIo.lines.push(line);
      return;
    }
    progressIo.writeErr(line);
    if (err instanceof Error && err.stack && isDebug()) {
      progressIo.writeErr(err.stack);
    }
  },
};

/**
 * While pretty progress is on, mute noisy info/success from Nuxt/Vite/Nitro.
 * Errors (consola level ≥ error) stay visible. Never mutes in CI / quiet / debug.
 * Always restores level and rethrows — does not swallow.
 */
export async function withQuietLogger<T>(fn: () => Promise<T>): Promise<T> {
  if (isDebug() || !isProgressEnabled()) return fn();
  const { consola, LogLevels } = await import('consola');
  const prev = consola.level;
  // Keep fatal+error; hide warn/info/success/build spam
  consola.level = LogLevels.error;
  try {
    return await fn();
  } finally {
    consola.level = prev;
  }
}
