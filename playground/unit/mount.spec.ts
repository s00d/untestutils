import { describe, expect, it } from 'vitest';
import { mountSuspended } from 'untestutils/runtime';
import HelloWorld from '../fixtures/unit-app/components/HelloWorld.vue';
import App from '../fixtures/unit-app/app.vue';

describe('mountSuspended', () => {
  it('mounts a component with props', async () => {
    const wrapper = await mountSuspended(HelloWorld, {
      props: { label: 'mounted' },
    });
    expect(wrapper.get('[data-testid="hello"]').text()).toBe('mounted');
  });

  it('mounts app.vue with Nuxt state', async () => {
    const wrapper = await mountSuspended(App);
    expect(wrapper.get('h1').text()).toBe('Unit App');
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('[data-testid="counter"]').text()).toBe('1');
  });
});
