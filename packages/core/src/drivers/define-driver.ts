import type { Recipe } from '..';

/** Framework/app adapter → Recipe. Core never imports frameworks. */
export type Driver<Opts = unknown> = (opts: Opts) => Recipe;

export function defineDriver<Opts>(impl: Driver<Opts>): Driver<Opts> {
  return impl;
}
