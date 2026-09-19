/**
 * Core recipe types — framework-free.
 */
export type RunningKind = 'url' | 'dir' | 'url+dir';

export interface RunningBase {
  stop?: () => Promise<void>;
  /** OS pid of the managed server (for cross-worker teardown via registry). */
  pid?: number;
}

export interface RunningUrl extends RunningBase {
  kind: 'url';
  url: string;
}

export interface RunningDir extends RunningBase {
  kind: 'dir';
  dir: string;
}

export interface RunningBoth extends RunningBase {
  kind: 'url+dir';
  url: string;
  dir: string;
}

export type Running = RunningUrl | RunningDir | RunningBoth;

export type SharePolicy = 'always' | 'never' | 'prepare-only';

export interface HashCtx {
  root?: string;
  outDir: string;
  artifactsRoot: string;
}

export interface PrepareCtx {
  root?: string;
  outDir: string;
  artifactsRoot: string;
  env: NodeJS.ProcessEnv;
  run: RunHelper;
}

export interface StartCtx {
  root?: string;
  outDir: string;
  artifactsRoot: string;
  port: number;
  host: string;
  env: NodeJS.ProcessEnv;
  run: RunHelper;
}

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface DetachedProcess {
  pid?: number;
  stop: () => Promise<void>;
  logs: () => string;
}

export interface RunHelper {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<RunResult>;
  detached: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<DetachedProcess>;
  command: (cmd: string, opts?: { cwd?: string; env?: NodeJS.ProcessEnv }) => Promise<RunResult>;
}

export interface Recipe {
  id?: string;
  hashInputs?: (ctx: HashCtx) => string[] | Promise<string[]>;
  prepare?: (ctx: PrepareCtx) => Promise<void>;
  start: (ctx: StartCtx) => Promise<Running>;
  ready?: (running: Running) => Promise<void>;
  verifyArtifact?: (outDir: string) => Promise<void>;
  share?: SharePolicy;
}

export type RecipeFactory<Opts = unknown> = (opts: Opts) => Recipe;

export interface RecipeRegistry {
  readonly [id: string]: Recipe;
}

export interface HarnessHandle {
  id: string;
  url?: string;
  dir?: string;
  $fetch: typeof import('ofetch').$fetch;
  files: {
    read: (rel: string) => Promise<string>;
    exists: (rel: string) => Promise<boolean>;
    list: (rel?: string) => Promise<string[]>;
  };
  dispose?: () => Promise<void>;
}

/** Options for `useHarness` / `leaseTarget` (orchestrator path). */
export interface UseHarnessOptions {
  artifactsRoot?: string;
  cwd?: string;
}

export const SCHEMA_VERSION = 1 as const;
