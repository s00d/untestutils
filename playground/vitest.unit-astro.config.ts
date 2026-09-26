import { defineVitestProject } from '@untestutils/astro/config';
import { markerUnitProjectOptions } from './unit-project.ts';

export default defineVitestProject(
  markerUnitProjectOptions({ framework: 'astro', kind: 'marker' }),
);
