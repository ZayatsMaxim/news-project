export interface SessionStorageHelper<T> {
  load(): T
  save(value: T): void
}

export function createSessionStorageHelper<T>(
  key: string,
  fallback: T,
  validate: (parsed: unknown) => T,
): SessionStorageHelper<T> {
  return {
    load(): T {
      try {
        const raw = sessionStorage.getItem(key)
        if (!raw) return fallback
        return validate(JSON.parse(raw))
      } catch {
        return fallback
      }
    },

    save(value: T): void {
      try {
        sessionStorage.setItem(key, JSON.stringify(value))
      } catch (e) {
        console.warn(`Failed to save "${key}" to sessionStorage`, e)
      }
    },
  }
}

export function validateNumberArray(parsed: unknown): number[] {
  return Array.isArray(parsed)
    ? parsed.filter((id): id is number => typeof id === 'number')
    : []
}
