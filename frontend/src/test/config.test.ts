import { describe, expect, it } from 'vitest'
import { REALTIME_HUB_PATH, resolveApiBaseUrl } from '../config'

describe('frontend runtime URLs', () => {
  it('uses local API fallback and normalizes an override', () => {
    expect(resolveApiBaseUrl()).toBe('http://localhost:5006')
    expect(resolveApiBaseUrl(' https://api.example.test/ ')).toBe('https://api.example.test')
  })

  it('keeps SignalR on the same-origin hub path', () => {
    expect(REALTIME_HUB_PATH).toBe('/hubs/realtime')
  })
})
