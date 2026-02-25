import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchJson, fetchPatchJson } from '@/api/httpClient'

function mockFetch(body: unknown, status = 200, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchJson', () => {
  it('performs a GET request and returns parsed JSON', async () => {
    const payload = { id: 1, title: 'Test' }
    globalThis.fetch = mockFetch(payload)

    const result = await fetchJson<typeof payload>('https://api.test/items')

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test/items', { signal: undefined })
    expect(result).toEqual(payload)
  })

  it('passes signal from options', async () => {
    globalThis.fetch = mockFetch({})
    const controller = new AbortController()

    await fetchJson('https://api.test/x', { signal: controller.signal })

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test/x', {
      signal: controller.signal,
    })
  })

  it('works without options', async () => {
    globalThis.fetch = mockFetch({ ok: true })

    const result = await fetchJson('https://api.test/y')

    expect(result).toEqual({ ok: true })
  })

  it('appends params as query string', async () => {
    globalThis.fetch = mockFetch({})

    await fetchJson('https://api.test/items', { params: { limit: 10, skip: 0 } })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/items?limit=10&skip=0',
      { signal: undefined },
    )
  })

  it('encodes param values in query string', async () => {
    globalThis.fetch = mockFetch({})

    await fetchJson('https://api.test/search', { params: { q: 'hello world', page: 1 } })

    const callUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
    expect(callUrl).toMatch(/q=hello(%20|\+)world/)
    expect(callUrl).toContain('page=1')
  })

  it('leaves URL unchanged when params is empty object', async () => {
    globalThis.fetch = mockFetch({})

    await fetchJson('https://api.test/items', { params: {} })

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test/items', { signal: undefined })
  })

  it('combines params and signal in options', async () => {
    globalThis.fetch = mockFetch({})
    const controller = new AbortController()

    await fetchJson('https://api.test/items', {
      params: { limit: 5 },
      signal: controller.signal,
    })

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test/items?limit=5', {
      signal: controller.signal,
    })
  })

  it('throws when response is not ok', async () => {
    globalThis.fetch = mockFetch(null, 404, false)

    await expect(fetchJson('https://api.test/missing')).rejects.toThrow('Failed to fetch: 404')
  })

  it('throws when response is 500', async () => {
    globalThis.fetch = mockFetch(null, 500, false)

    await expect(fetchJson('https://api.test/error')).rejects.toThrow('Failed to fetch: 500')
  })

  it('propagates fetch network errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchJson('https://api.test/fail')).rejects.toThrow('Failed to fetch')
  })

  it('propagates AbortError when request is aborted', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    globalThis.fetch = vi.fn().mockRejectedValue(abortError)

    await expect(fetchJson('https://api.test/abort')).rejects.toSatisfy(
      (e: unknown) => e instanceof DOMException && e.name === 'AbortError',
    )
  })
})

describe('fetchPatchJson', () => {
  it('performs a PATCH request with JSON body and returns parsed response', async () => {
    const responsePayload = { id: 1, title: 'Updated' }
    globalThis.fetch = mockFetch(responsePayload)

    const result = await fetchPatchJson<typeof responsePayload>('https://api.test/items/1', {
      title: 'Updated',
    })

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test/items/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
      signal: undefined,
    })
    expect(result).toEqual(responsePayload)
  })

  it('passes signal from options', async () => {
    globalThis.fetch = mockFetch({})
    const controller = new AbortController()

    await fetchPatchJson('https://api.test/items/1', { a: 1 }, { signal: controller.signal })

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit
    expect(callArgs.signal).toBe(controller.signal)
  })

  it('works without options', async () => {
    globalThis.fetch = mockFetch({ ok: true })

    const result = await fetchPatchJson('https://api.test/items/1', { x: 'y' })

    expect(result).toEqual({ ok: true })
  })

  it('throws when response is not ok', async () => {
    globalThis.fetch = mockFetch(null, 403, false)

    await expect(
      fetchPatchJson('https://api.test/items/1', { title: 'X' }),
    ).rejects.toThrow('Failed to fetch: 403')
  })

  it('serializes body as JSON', async () => {
    globalThis.fetch = mockFetch({})
    const body = { title: 'Hello', body: 'World', nested: { a: 1 } }

    await fetchPatchJson('https://api.test/items/1', body)

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit
    expect(callArgs.body).toBe(JSON.stringify(body))
  })

  it('appends params as query string', async () => {
    globalThis.fetch = mockFetch({})

    await fetchPatchJson('https://api.test/items/1', { title: 'X' }, { params: { foo: 'bar' } })

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test/items/1?foo=bar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X' }),
      signal: undefined,
    })
  })
})
