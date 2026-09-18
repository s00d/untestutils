import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { mountSuspended, mockNuxtImport } from 'untestutils/runtime';
import App from '../fixtures/unit-app/app.vue';

describe('mockNuxtImport dogfood', () => {
  it('replaces useState via compile-time macro', async () => {
    mockNuxtImport('useState', () => {
      return (key: string, init?: () => unknown) => {
        if (key === 'title') return ref('Mocked Title');
        return ref(init ? init() : null);
      };
    });
    const wrapper = await mountSuspended(App);
    expect(wrapper.get('h1').text()).toBe('Mocked Title');
  });
});
