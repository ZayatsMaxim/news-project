/**
 * Приводит значение к конечному числу; при нечисловом или неконечном возвращает fallback.
 * Используется при разборе API-ответов и данных из storage.
 */
export function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
