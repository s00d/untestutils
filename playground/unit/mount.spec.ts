import { describe, expect, it } from 'vitest';
import { mountSuspended } from 'untestutils/runtime';
import HelloWorld from '../fixtures/unit-app/components/HelloWorld.vue';
import App from '../fixtures/unit-app/app.vue';
import AboutPage from '../fixtures/unit-app/pages/about.vue';

describe('mountSuspended', () => {
  it('mounts a component with props', async () => {
    const wrapper = await mountSuspended(HelloWorld, {
      props: { label: 'mounted' },
    });
    expect(wrapper.get('[data-testid="hello"]').text()).toBe('mounted');
  });

  it('mounts app.vue with Nuxt state and runtimeConfig', async () => {
    const wrapper = await mountSuspended(App);
    expect(wrapper.get('h1').text()).toBe('Unit App');
    expect(wrapper.get('[data-testid="runtime-app"]').text()).toBe('unit-app');
    expect(wrapper.get('[data-testid="badge"]').text()).toBe('ready');
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('[data-testid="counter"]').text()).toBe('1');
  });

  it('supports setProps after mount', async () => {
    const wrapper = await mountSuspended(HelloWorld, {
      props: { label: 'before' },
    });
    expect(wrapper.get('[data-testid="hello"]').text()).toBe('before');
    await wrapper.setProps({ label: 'after' });
    expect(wrapper.get('[data-testid="hello"]').text()).toBe('after');
  });

  it('mounts a page component with an explicit route', async () => {
    const wrapper = await mountSuspended(AboutPage, {
      route: '/about',
    });
    expect(wrapper.get('[data-testid="about-page"]').text()).toBe('About page');
  });
});
