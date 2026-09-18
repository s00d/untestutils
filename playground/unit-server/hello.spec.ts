import { describe, expect, it } from 'vitest'
import { registerEndpoint } from 'untestutils/runtime'

/**
 * Server unit path with `nitroEnvironment: true` (see vitest.unit-nuxt-server.config.ts).
 * Boots the in-process env with Nitro kept alive and exercises handler wiring via $fetch.
 */
describe('server unit dogfood', () => {
  it('serves a handler through in-process $fetch', async () => {
    registerEndpoint('/api/hello', () => ({ ok: true, from: 'api-hello' }))
    const data = await $fetch<{ ok: boolean; from: string }>('/api/hello')
    expect(data).toMatchObject({ ok: true, from: 'api-hello' })
  })

  it('imports the nitro route module under nitroEnvironment', async () => {
    const mod = await import('../fixtures/unit-app/server/api/hello.get')
    const handler = mod.default
    expect(typeof handler).toBe('function')
    const result = await handler({} as any)
    expect(result).toMatchObject({ ok: true, from: 'api-hello' })
  })
})
