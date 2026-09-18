import { initCommand } from './init';
import { convertCommand } from './convert';
import { aiCommand } from './ai';
import { doctorCommand } from './doctor';
import { buildCommand } from './build';
import { apiSurfaceCommand } from './api-surface';
import { packTestCommand } from './pack-test';
import { preflightCommand } from './preflight';
import { fixCommand } from './fix';
import { coverCommand } from './cover';
import { perfCommand } from './perf';

export const commands = {
  init: initCommand,
  convert: convertCommand,
  ai: aiCommand,
  fix: fixCommand,
  cover: coverCommand,
  doctor: doctorCommand,
  build: buildCommand,
  'api-surface': apiSurfaceCommand,
  'pack-test': packTestCommand,
  preflight: preflightCommand,
  perf: perfCommand,
};
