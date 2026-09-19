import { initCommand } from './init';
import { convertCommand } from './convert';
import { aiCommand } from './ai';
import { doctorCommand } from './doctor';
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
  perf: perfCommand,
};
