import { expect, test } from 'vitest';
import { mountSuspended } from 'untestutils/runtime';
import HelloWorld from '../fixtures/unit-app/components/HelloWorld.vue';

test('mount 02', async () => {
  const wrapper = await mountSuspended(HelloWorld, { props: { label: 'bench-2' } });
  expect(wrapper.text()).toContain('bench-2');
});
