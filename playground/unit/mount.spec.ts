import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from 'untestutils/runtime'
import HelloWorld from '../fixtures/unit-app/components/HelloWorld.vue'
import App from '../fixtures/unit-app/app.vue'

describe('unit-nuxt dogfood', () => {
  it('mounts a component with mountSuspended', async () => {
    const wrapper = await mountSuspended(HelloWorld, {
      props: { label: 'mounted' },
    })
    expect(wrapper.text()).toContain('mounted')
  })

  it('mounts app.vue with Nuxt state', async () => {
    const wrapper = await mountSuspended(App)
    expect(wrapper.get('h1').text()).toBe('Unit App')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('[data-testid="counter"]').text()).toBe('1')
  })

  it('registerEndpoint mocks $fetch', async () => {
    registerEndpoint('/api/hello', () => ({ ok: true, mocked: true }))
    const data = await $fetch('/api/hello')
    expect(data).toEqual({ ok: true, mocked: true })
  })
})
