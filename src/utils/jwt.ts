/**
 * Декодирует payload JWT (вторая часть токена) и возвращает объект.
 * Не проверяет подпись — только чтение полей (exp и т.д.).
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

/** exp в JWT — секунды с 01.01.1970. Считаем просроченным за bufferSeconds до истечения. */
const DEFAULT_BUFFER_SECONDS = 60

/**
 * Возвращает true, если JWT просрочен (или истечёт в течение bufferSeconds).
 */
export function isJwtExpired(
  token: string,
  bufferSeconds: number = DEFAULT_BUFFER_SECONDS,
): boolean {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return true
  return Date.now() / 1000 >= exp - bufferSeconds
}
