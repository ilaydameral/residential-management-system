export const REALTIME_HUB_PATH = '/hubs/realtime'

export function resolveApiBaseUrl(configuredValue?: string): string {
  return (configuredValue?.trim() || 'http://localhost:5006').replace(/\/$/, '')
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
