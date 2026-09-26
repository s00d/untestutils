import { expect, test } from 'vitest';
import { mountSuspended } from 'untestutils/runtime';
import HelloWorld from '../fixtures/unit-app/components/HelloWorld.vue';

test('mount 01', async () => {
  const wrapper = await mountSuspended(HelloWorld, { props: { label: 'bench-1' } });
  expect(wrapper.text()).toContain('bench-1');
});
