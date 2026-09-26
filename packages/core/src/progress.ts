import { envFlag, isDebug } from './debug';

const ID_WIDTH = 22;

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
 * Compact harness progress (prepare wave + mass-run banner).
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

function useFancy(): boolean {
  if (!isProgressEnabled()) return false;
  if (isCi()) return false;
  return process.stdout.isTTY === true;
}

type WaveState = {
  total: number;
  ready: number;
  building: Set<string>;
  /** Suppress per-id `→ start` noise while the prepare wave is active. */
  active: boolean;
  startedAt: number;
  massRunShown: boolean;
};

/** @internal mutable seam for unit tests */
export const progressIo: {
  lines: string[];
  capture: boolean;
  bannerShown: boolean;
  wave: WaveState | null;
  write: (line: string) => void;
  writeErr: (line: string) => void;
  reset: () => void;
} = {
  lines: [] as string[],
  capture: false,
  bannerShown: false,
  wave: null as WaveState | null,
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
    this.wave = null;
  },
};

function padId(s: string): string {
  if (s.length > ID_WIDTH) return `${s.slice(0, ID_WIDTH - 1)}…`;
  return s.padEnd(ID_WIDTH);
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
  emit(
    useFancy()
      ? '◆ untestutils  ·  mass e2e on live targets'
      : '[untestutils] mass e2e on live targets',
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function check(ok = true): string {
  if (!useFancy()) return ok ? '+' : 'x';
  return ok ? '✔' : '✖';
}

function arrow(): string {
  return useFancy() ? '▸' : '>';
}

/**
 * Harness console UX — mirrors the README demo:
 * prepare once → shared hosts → mass run on live URLs.
 */
export const progress = {
  /**
   * Start a prepare wave (typically `prewarm` in globalSetup).
   * Groups many recipe prepares under one banner.
   */
  waveStart(ids: string[]): void {
    ensureBanner();
    const total = ids.length;
    progressIo.wave = {
      total,
      ready: 0,
      building: new Set(),
      active: true,
      startedAt: Date.now(),
      massRunShown: false,
    };
    emit('');
    emit(
      `${arrow()} prepare once` +
        (useFancy()
          ? '  — every worker reuses the same builds'
          : `  (${total} recipes, shared across workers)`),
    );
    if (total) {
      emit(`  ${total} recipes in the wave`);
    }
  },

  prepareStart(id: string): void {
    ensureBanner();
    if (progressIo.wave?.active) {
      progressIo.wave.building.add(id);
      emit(`  ${padId(id)}  building…`);
      return;
    }
    emit(`  ${useFancy() ? '●' : '*'} ${padId(id)}  building…`);
  },

  prepareDone(id: string, ms: number): void {
    ensureBanner();
    if (progressIo.wave?.active) {
      progressIo.wave.building.delete(id);
      progressIo.wave.ready += 1;
      emit(`  ${check()} ${padId(id)}  built · ${formatDuration(ms)}`);
      return;
    }
    emit(`  ${check()} ${padId(id)}  built · ${formatDuration(ms)}`);
  },

  prepareCache(id: string): void {
    ensureBanner();
    if (progressIo.wave?.active) {
      progressIo.wave.building.delete(id);
      progressIo.wave.ready += 1;
      emit(`  ${check()} ${padId(id)}  cached`);
      return;
    }
    emit(`  ${check()} ${padId(id)}  cached`);
  },

  /**
   * Close the prepare wave and announce shared hosts are warm.
   * Call after all prewarm `ensurePrepared` calls finish.
   */
  waveReady(): void {
    const wave = progressIo.wave;
    if (!wave?.active) return;
    wave.active = false;
    const ready = wave.ready || wave.total;
    const total = wave.total || ready;
    emit(
      `  ${check()} ${ready}/${total} warm` +
        (useFancy() ? '  ·  shared host registry' : '  · shared hosts'),
    );
  },

  /**
   * Banner before specs hit live URLs (after prepare wave).
   * Safe to call multiple times — only prints once per process.
   */
  massRun(): void {
    ensureBanner();
    if (progressIo.wave?.massRunShown) return;
    if (progressIo.wave) progressIo.wave.massRunShown = true;
    emit('');
    emit(
      `${arrow()} mass run` +
        (useFancy()
          ? '  live URLs · real cookies/SEO/$fetch · no per-file rebuild'
          : '  live URLs · shared prepare'),
    );
  },

  start(id: string, url: string): void {
    ensureBanner();
    // During the wave, URLs are implied by warm hosts — keep the wave compact.
    if (progressIo.wave?.active) return;
    // After waveReady, first start triggers mass-run banner if not shown.
    if (progressIo.wave && !progressIo.wave.massRunShown) {
      progress.massRun();
    }
    emit(`  ${useFancy() ? '→' : '>'} ${padId(id)}  ${url}`);
  },

  teardown(): void {
    ensureBanner();
    const wave = progressIo.wave;
    emit('');
    if (wave && wave.total > 0) {
      const elapsed = formatDuration(Date.now() - wave.startedAt);
      emit(
        `  ${wave.ready || wave.total} recipes prepared once` +
          (useFancy() ? `  ·  session ${elapsed}` : `  · ${elapsed}`),
      );
    }
    emit(useFancy() ? '  prepare once  →  many workers  →  real URLs & data' : '  teardown  stop');
    emit(`  ${useFancy() ? '■' : '='} teardown`);
  },

  /** Always surfaces failures — never swallowed by quiet/CI. */
  fail(id: string, err: unknown): void {
    const line = `  ${check(false)} ${padId(id)}  ${errMessage(err)}`;
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
  consola.level = LogLevels.error;
  try {
    return await fn();
  } finally {
    consola.level = prev;
  }
}
