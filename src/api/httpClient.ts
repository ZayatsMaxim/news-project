/**
 * Общий клиент для GET-запросов к API.
 * Единая обработка fetch, проверки response.ok и парсинга JSON.
 */

export interface FetchJsonOptions {
  signal?: AbortSignal
  params?: Record<string, string | number>
}

function buildUrl(
  base: string,
  params?: Record<string, string | number>,
): string {
  if (!params || Object.keys(params).length === 0) return base
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/**
 * Выполняет GET-запрос по url, проверяет response.ok и возвращает JSON.
 * При response.ok === false выбрасывает Error с кодом статуса.
 */
export async function fetchJson<T>(
  url: string,
  options?: FetchJsonOptions,
): Promise<T> {
  const { signal, params } = options ?? {}
  const finalUrl = buildUrl(url, params)
  const response = await fetch(finalUrl, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`)
  }
  return (await response.json()) as T
}

/**
 * Выполняет PATCH-запрос с JSON-телом, проверяет response.ok и возвращает JSON.
 */
export async function fetchPatchJson<T>(
  url: string,
  body: Record<string, unknown>,
  options?: FetchJsonOptions,
): Promise<T> {
  const { signal, params } = options ?? {}
  const finalUrl = buildUrl(url, params)
  const response = await fetch(finalUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`)
  }
  return (await response.json()) as T
}
