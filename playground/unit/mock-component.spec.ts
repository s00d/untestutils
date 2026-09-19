import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mountSuspended, mockComponent } from 'untestutils/runtime';
import HelloWorld from '../fixtures/unit-app/components/HelloWorld.vue';
import StatusBadge from '../fixtures/unit-app/components/StatusBadge.vue';

describe('mockComponent', () => {
  it('replaces a named component via compile-time macro', async () => {
    mockComponent('StatusBadge', () =>
      defineComponent({
        setup: () => () => h('span', { 'data-testid': 'badge' }, 'mocked-badge'),
      }),
    );

    const Host = defineComponent({
      components: { StatusBadge },
      setup: () => () => h(StatusBadge, { text: 'ignored' }),
    });

    const wrapper = await mountSuspended(Host);
    expect(wrapper.get('[data-testid="badge"]').text()).toBe('mocked-badge');
  });

  it('can mock HelloWorld by pascal name', async () => {
    mockComponent('HelloWorld', () =>
      defineComponent({
        setup: () => () => h('div', { 'data-testid': 'hello' }, 'mocked-hello'),
      }),
    );
    const wrapper = await mountSuspended(HelloWorld, { props: { label: 'x' } });
    expect(wrapper.get('[data-testid="hello"]').text()).toBe('mocked-hello');
  });
});
