import { defineVitestProject } from '@untestutils/sveltekit/config';
import { markerUnitProjectOptions } from './unit-project.ts';

export default defineVitestProject(markerUnitProjectOptions({ framework: 'sveltekit', kind: 'worker' }));
