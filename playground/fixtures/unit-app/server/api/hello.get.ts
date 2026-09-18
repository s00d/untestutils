import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return { ok: true, from: 'api-hello' }
})
