import { describe, expect, it } from 'vitest';
import { mountSuspended } from 'untestutils/runtime';
import { defineComponent, h } from 'vue';

describe('Nuxt runtime injections', () => {
  it('exposes useNuxtApp and useRuntimeConfig inside mountSuspended', async () => {
    const Probe = defineComponent({
      setup() {
        const nuxtApp = useNuxtApp();
        const config = useRuntimeConfig();
        return () =>
          h('div', [
            h('span', { 'data-testid': 'has-nuxt' }, String(Boolean(nuxtApp))),
            h('span', { 'data-testid': 'app-name' }, String(config.public.appName)),
          ]);
      },
    });

    const wrapper = await mountSuspended(Probe);
    expect(wrapper.get('[data-testid="has-nuxt"]').text()).toBe('true');
    expect(wrapper.get('[data-testid="app-name"]').text()).toBe('unit-app');
  });
});
