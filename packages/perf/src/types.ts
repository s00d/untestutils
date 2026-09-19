export type BundleClass = 'code' | 'asset' | 'other';

export type BundleSize = {
  total: number;
  code: number;
  asset: number;
  other: number;
  /** Per top-level dir name → bytes */
  byDir: Record<string, number>;
};

export type ProcessMetrics = {
  maxMemoryMb: number;
  minMemoryMb: number;
  avgMemoryMb: number;
  maxCpuPct: number;
  minCpuPct: number;
  avgCpuPct: number;
};

export type AutocannonResult = {
  requests: { average: number; mean: number; total: number };
  latency: {
    average: number;
    mean: number;
    min: number;
    max: number;
    p50: number;
    p97_5: number;
    p99: number;
  };
  throughput: { average: number };
  errors: number;
};

export type ArtillerySummary = {
  min: number;
  max: number;
  count: number;
  mean: number;
  p50: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
};

/** Artillery report JSON (same shape as CLI `--output`; filled from in-process SSMS). */
export type ArtilleryResult = {
  aggregate: {
    counters: Record<string, number | undefined>;
    rates: Record<string, number | undefined>;
    firstMetricAt: number;
    lastMetricAt: number;
    summaries: Record<string, ArtillerySummary>;
    histograms: Record<string, ArtillerySummary>;
  };
  intermediate?: Array<{
    counters: Record<string, number>;
    rates: Record<string, number | null | undefined>;
    period?: string;
    summaries?: Record<string, ArtillerySummary>;
    histograms?: Record<string, ArtillerySummary>;
  }>;
};

/**
 * Inline Artillery test script.
 * Prefer `import type { TestScript } from 'artillery'` at call sites when the
 * optional peer is installed — assignability holds for normal scripts.
 */
export type ArtilleryScript = {
  config?: {
    target?: string;
    phases?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  scenarios?: Array<Record<string, unknown>>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  [key: string]: unknown;
};

export type BuildMetrics = ProcessMetrics & {
  buildTimeSec: number;
  bundle?: BundleSize;
};

export type LoadMetrics = ProcessMetrics & {
  durationSec?: number;
  responseTimeAvg?: number;
  responseTimeMin?: number;
  responseTimeMax?: number;
  responseTimeP50?: number;
  responseTimeP95?: number;
  responseTimeP99?: number;
  requestsPerSecond?: number;
  errorRate?: number;
  autocannon?: AutocannonResult;
  artillery?: ArtilleryResult;
};

export type PerfTargetResult = {
  id: string;
  label: string;
  build: BuildMetrics;
  load?: LoadMetrics;
};

export type SpawnSpec = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export type PerfTargetBuild = SpawnSpec & {
  /** Filter stdout lines to log (default: high-signal only) */
  logFilter?: (line: string) => boolean;
};

export type PerfTargetStart = SpawnSpec & {
  port: number;
  host?: string;
  readyPath?: string;
  readyTimeoutMs?: number;
};

export type PerfTargetLoad = {
  /** Paths for documentation / future multi-url; autocannon hits base URL */
  paths?: string[];
  /** `true` = defaults; object = overrides. Omitted = skip autocannon. */
  autocannon?: boolean | { connections?: number; durationSec?: number };
  /**
   * Artillery load. Prefer a file path, or pass an inline script object
   * (type as `import('artillery').TestScript` when the peer is installed).
   */
  artillery?: { config: string } | { script: ArtilleryScript };
};

export type PerfTargetBundle = {
  /** Absolute or root-relative dirs to walk after build */
  dirs: string[];
  classify?: (absPath: string) => BundleClass;
};

export type PerfTarget = {
  id: string;
  label?: string;
  root: string;
  build: PerfTargetBuild;
  start: PerfTargetStart;
  load?: PerfTargetLoad;
  bundle?: PerfTargetBundle;
};

export type PerfReporterContext = {
  suite: PerfSuite;
  results: PerfTargetResult[];
  runs: number;
  skipLoad: boolean;
};

export type PerfReporter = {
  name: string;
  onStart?: (suite: PerfSuite) => void | Promise<void>;
  onTarget?: (result: PerfTargetResult) => void | Promise<void>;
  onEnd?: (ctx: PerfReporterContext) => void | Promise<void>;
};

export type PerfThresholds = {
  buildTimeSec?: number;
  maxMemoryMb?: number;
  requestsPerSecond?: number;
  responseTimeP95?: number;
  errorRate?: number;
};

export type PerfSuite = {
  /** Absolute or cwd-relative output for JSON / temp load artifacts */
  artifactsDir?: string;
  runs?: number;
  skipLoad?: boolean;
  coolDownMs?: number;
  targets: PerfTarget[];
  beforeAll?: (suite: PerfSuite) => void | Promise<void>;
  beforeTarget?: (target: PerfTarget) => void | Promise<void>;
  afterTarget?: (target: PerfTarget, result: PerfTargetResult) => void | Promise<void>;
  reporters?: PerfReporter[];
  thresholds?: PerfThresholds;
  /** Select subset by id or label prefix */
  only?: string | string[];
};

export type RunPerfOptions = {
  runs?: number;
  skipLoad?: boolean;
  only?: string | string[];
  json?: boolean;
};
