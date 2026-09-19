import { join, resolve } from 'pathe';
import { resolveArtifactsRoot } from './paths';

/** Sanitize session segment for filesystem / env use. */
export function sanitizeSession(session: string): string {
  const s = session.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) {
    throw new Error('[untestutils] session must be a non-empty identifier');
  }
  return s;
}

/**
 * Resolve artifacts root with optional session isolation.
 * Explicit `artifactsRoot` wins; otherwise `session` / `UNTESTUTILS_SESSION`
 * nests under `.untestutils/sessions/<session>/`.
 */
export function resolveSessionArtifactsRoot(
  opts: {
    artifactsRoot?: string;
    session?: string;
    cwd?: string;
  } = {},
): string {
  const cwd = opts.cwd ?? process.cwd();
  if (opts.artifactsRoot) return resolve(cwd, opts.artifactsRoot);
  const base = resolveArtifactsRoot(cwd);
  const session = opts.session ?? process.env.UNTESTUTILS_SESSION;
  if (session) return join(base, 'sessions', sanitizeSession(session));
  return base;
}
