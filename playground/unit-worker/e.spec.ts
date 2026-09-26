import { expect, test } from 'vitest';
import { mountSuspended } from 'untestutils/runtime';
import HelloWorld from '../fixtures/unit-app/components/HelloWorld.vue';

test('worker-e mounts', async () => {
  const wrapper = await mountSuspended(HelloWorld, { props: { label: 'worker' } });
  expect(wrapper.text()).toContain('worker');
});
