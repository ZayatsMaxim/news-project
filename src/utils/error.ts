/**
 * Проверяет, является ли ошибка отменой запроса (AbortController).
 * Используется, чтобы не логировать отменённые запросы как ошибки.
 */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}
