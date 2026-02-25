/**
 * Проверяет, является ли ошибка отменой запроса (AbortController).
 * Используется, чтобы не логировать отменённые запросы как ошибки.
 */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

/** Возвращает HTTP-код статуса из ошибки, если он задан (например, из httpClient). */
export function getHttpStatus(e: unknown): number | undefined {
  if (e != null && typeof e === 'object' && 'status' in e) {
    const v = (e as { status: unknown }).status
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined
  }
  return undefined
}

/** Возвращает true, если ошибка — ответ с кодом 404. */
export function isNotFoundError(e: unknown): boolean {
  return getHttpStatus(e) === 404
}
