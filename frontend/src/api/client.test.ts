import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './client'

describe('apiRequest', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns typed JSON for a successful request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    await expect(apiRequest<{ status: string }>('/api/health')).resolves.toEqual({ status: 'ok' })
  })

  it.each([[404, 'not_found'], [422, 'validation'], [500, 'server']] as const)(
    'classifies HTTP %s errors', async (status, kind) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ detail: '오류' }), {
        status, headers: { 'Content-Type': 'application/json' },
      }))
      await expect(apiRequest('/api/fail')).rejects.toMatchObject({ kind, status, message: '오류' })
    },
  )

  it('classifies a connection failure without crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed'))
    await expect(apiRequest('/api/health')).rejects.toMatchObject({ kind: 'network', status: null })
  })
})
