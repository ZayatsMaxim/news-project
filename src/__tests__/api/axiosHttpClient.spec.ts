import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockAccessToken: string | null = null
vi.mock('@/stores/loginUserStore', () => ({
  useLoginUserStore: () => ({
    get accessToken() {
      return mockAccessToken
    },
  }),
}))

vi.mock('@/config/api', () => ({
  apiConfig: {
    authBaseUrl: 'https://api.test/auth',
  },
}))

const { apiClient } = await import('@/api/axiosHttpClient')

beforeEach(() => {
  mockAccessToken = null
})

describe('apiClient', () => {
  it('has baseURL and timeout from config', () => {
    expect(apiClient.defaults.baseURL).toBe('https://api.test/auth')
    expect(apiClient.defaults.timeout).toBe(15_000)
  })

  it('sets Content-Type application/json by default', () => {
    const headers = apiClient.defaults.headers as Record<string, unknown>
    const common = headers.common as Record<string, string> | undefined
    const contentType = (headers['Content-Type'] as string | undefined) ?? common?.['Content-Type']
    expect(contentType).toBe('application/json')
  })

  it('adds Authorization Bearer when store has accessToken', async () => {
    mockAccessToken = 'secret-token-123'
    const adapter = vi.fn().mockResolvedValue({ data: null, status: 200 })
    apiClient.defaults.adapter = adapter

    await apiClient.get('/me')

    const config = adapter.mock.calls[0]![0]
    expect(config.headers.Authorization).toBe('Bearer secret-token-123')
  })

  it('does not add Authorization when store has no token', async () => {
    mockAccessToken = null
    const adapter = vi.fn().mockResolvedValue({ data: null, status: 200 })
    apiClient.defaults.adapter = adapter

    await apiClient.get('/me')

    const config = adapter.mock.calls[0]![0]
    expect(config.headers.Authorization).toBeUndefined()
  })

  it('does not add Authorization when token is empty string', async () => {
    mockAccessToken = ''
    const adapter = vi.fn().mockResolvedValue({ data: null, status: 200 })
    apiClient.defaults.adapter = adapter

    await apiClient.get('/me')

    const config = adapter.mock.calls[0]![0]
    expect(config.headers.Authorization).toBeUndefined()
  })
})
