import { defineVitestProject } from '@untestutils/next/config';
import { markerUnitProjectOptions } from './unit-project.ts';

export default defineVitestProject(markerUnitProjectOptions({ framework: 'next', kind: 'worker' }));
