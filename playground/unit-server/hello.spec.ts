import { describe, expect, it } from 'vitest'
import { registerEndpoint } from 'untestutils/runtime'

/**
 * Server unit path with `nitroEnvironment: true` (see vitest.unit-nuxt-server.config.ts).
 * Real Nitro route modules are importable; wire them into in-process `$fetch`
 * via `registerEndpoint` (same h3 app the environment owns).
 */
describe('server unit dogfood', () => {
  it('serves the real nitro handler through in-process $fetch', async () => {
    const { default: handler } = await import('../fixtures/unit-app/server/api/hello.get')
    registerEndpoint('/api/hello', (event) => handler(event))
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
