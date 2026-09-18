import { describe, expect, it } from 'vitest'
import { mountSuspended } from 'untestutils/runtime'

describe('unit smoke', () => {
  it('mountSuspended is available', async () => {
    expect(typeof mountSuspended).toBe('function')
  })
})
