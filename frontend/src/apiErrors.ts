import type { ApiErrorResponse } from './types'

export const NETWORK_ERROR_MESSAGE = 'Sunucuya ulaşılamadı. Backend servisinin çalıştığını kontrol edin.'

export async function getApiErrorMessage(response: Response, isAuthEndpoint = false): Promise<string> {
  const defaultMessage = response.status === 401
    ? isAuthEndpoint
      ? 'Kullanıcı adı/e-posta veya parola hatalı.'
      : 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.'
    : 'Sunucuda bir hata oluştu.'

  try {
    const errorJson = await response.clone().json() as ApiErrorResponse
    if (errorJson.message) return errorJson.message
    if (errorJson.errors) {
      const firstErrorKey = Object.keys(errorJson.errors)[0]
      const firstError = firstErrorKey ? errorJson.errors[firstErrorKey]?.[0] : undefined
      if (firstError) return firstError
    }
    return defaultMessage
  } catch {
    return response.status === 401
      ? defaultMessage
      : `İstek başarısız oldu (HTTP ${response.status}).`
  }
}
