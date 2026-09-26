import { defineVitestProject } from '@untestutils/solidstart/config';
import { markerUnitProjectOptions } from './unit-project.ts';

export default defineVitestProject(markerUnitProjectOptions({ framework: 'solidstart', kind: 'worker' }));
