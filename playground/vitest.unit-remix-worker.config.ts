import { defineVitestProject } from '@untestutils/remix/config';
import { markerUnitProjectOptions } from './unit-project.ts';

export default defineVitestProject(
  markerUnitProjectOptions({ framework: 'remix', kind: 'worker' }),
);
