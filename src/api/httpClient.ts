/**
 * Общий клиент для GET-запросов к API.
 * Единая обработка fetch, проверки response.ok и парсинга JSON.
 */

export interface FetchJsonOptions {
  signal?: AbortSignal
}

/**
 * Выполняет GET-запрос по url, проверяет response.ok и возвращает JSON.
 * При response.ok === false выбрасывает Error с кодом статуса.
 */
export async function fetchJson<T>(
  url: string,
  options?: FetchJsonOptions,
): Promise<T> {
  const { signal } = options ?? {}
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`)
  }
  return (await response.json()) as T
}
