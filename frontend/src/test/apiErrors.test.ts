import { describe, expect, it, vi } from 'vitest'
import { getProperties } from '../api'
import { getApiErrorMessage, NETWORK_ERROR_MESSAGE } from '../apiErrors'

describe('API error messages', () => {
  it.each([400, 403, 404, 409, 503, 504])('uses safe backend message for HTTP %i', async (status) => {
    const response = new Response(JSON.stringify({ message: `Güvenli mesaj ${status}` }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
    await expect(getApiErrorMessage(response)).resolves.toBe(`Güvenli mesaj ${status}`)
  })

  it('uses a concise session message for a non-auth 401', async () => {
    const response = new Response('', { status: 401 })
    await expect(getApiErrorMessage(response)).resolves.toBe('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.')
  })

  it('uses validation details without exposing technical content', async () => {
    const response = new Response(JSON.stringify({ errors: { title: ['Başlık zorunludur.'] } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
    await expect(getApiErrorMessage(response)).resolves.toBe('Başlık zorunludur.')
  })

  it('uses status fallback for malformed error responses', async () => {
    const response = new Response('<html>gateway</html>', { status: 504 })
    await expect(getApiErrorMessage(response)).resolves.toBe('İstek başarısız oldu (HTTP 504).')
  })

  it('defines a non-technical network failure message', () => {
    expect(NETWORK_ERROR_MESSAGE).toBe('Sunucuya ulaşılamadı. Backend servisinin çalıştığını kontrol edin.')
  })

  it('maps a fetch rejection to the non-technical network message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')))

    try {
      await expect(getProperties()).rejects.toThrow(NETWORK_ERROR_MESSAGE)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
