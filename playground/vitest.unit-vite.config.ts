import { defineVitestProject } from '@untestutils/vite/config';
import { markerUnitProjectOptions } from './unit-project.ts';

export default defineVitestProject(markerUnitProjectOptions({ framework: 'vite', kind: 'marker' }));
