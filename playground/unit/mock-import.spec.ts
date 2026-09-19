import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { mountSuspended, mockNuxtImport, unmockNuxtImport } from 'untestutils/runtime';
import App from '../fixtures/unit-app/app.vue';

describe('mockNuxtImport + unmockNuxtImport', () => {
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

  it('restores the auto-import after unmock in the same file', async () => {
    unmockNuxtImport('useState');
    const wrapper = await mountSuspended(App);
    expect(wrapper.get('h1').text()).toBe('Unit App');
  });
});
