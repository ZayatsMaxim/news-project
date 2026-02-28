import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUser, login, refreshAuth, getAuthUser } from '@/api/userApi'

vi.mock('@/api/axiosHttpClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/config/api', () => ({
  apiConfig: {
    baseUrl: 'https://api.test',
    usersBaseUrl: 'https://api.test/users',
    authBaseUrl: 'https://api.test/auth',
  },
}))

import { apiClient } from '@/api/axiosHttpClient'

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)

function makeRawUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    company: { title: 'Engineer', department: 'IT' },
    ...overrides,
  }
}

function makeRawUserLogin(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    gender: 'male',
    image: 'https://example.com/avatar.png',
    accessToken: 'access-123',
    refreshToken: 'refresh-456',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getUser', () => {
  it('fetches user by id and normalizes result', async () => {
    mockedGet.mockResolvedValue({ data: makeRawUser({ id: 5 }) })

    const result = await getUser(5)

    expect(mockedGet).toHaveBeenCalledWith(
      'https://api.test/users/5',
      expect.objectContaining({
        params: { select: 'firstName,lastName,company' },
      }),
    )
    expect(result).toEqual({
      id: 5,
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      jobTitle: 'Engineer',
      department: 'IT',
    })
  })

  it('passes signal to request config', async () => {
    mockedGet.mockResolvedValue({ data: makeRawUser() })
    const controller = new AbortController()

    await getUser(1, controller.signal)

    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringContaining('/1'),
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('returns defaults for missing string fields', async () => {
    mockedGet.mockResolvedValue({ data: { id: 2 } })

    const result = await getUser(2)

    expect(result.username).toBe('')
    expect(result.firstName).toBe('')
    expect(result.lastName).toBe('')
  })
})

describe('login', () => {
  it('posts credentials and returns mapped UserLoginDto', async () => {
    const raw = makeRawUserLogin({ username: 'alice', firstName: 'Alice' })
    mockedPost.mockResolvedValue({ data: raw })

    const result = await login('alice', 'secret')

    expect(mockedPost).toHaveBeenCalledWith('https://api.test/auth/login', {
      username: 'alice',
      password: 'secret',
    })
    expect(result.username).toBe('alice')
    expect(result.firstName).toBe('Alice')
    expect(result.accessToken).toBe('access-123')
    expect(result.refreshToken).toBe('refresh-456')
  })

  it('returns defaults for missing raw fields', async () => {
    mockedPost.mockResolvedValue({ data: { id: 1 } })

    const result = await login('x', 'y')

    expect(result.username).toBe('')
    expect(result.gender).toBe('other')
    expect(result.image).toBe('')
  })
})

describe('refreshAuth', () => {
  it('posts refresh token to /auth/refresh and returns tokens', async () => {
    const payload = { accessToken: 'new-access', refreshToken: 'new-refresh' }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    })

    const result = await refreshAuth('old-refresh')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'old-refresh', expiresInMins: 30 }),
      }),
    )
    expect(result).toEqual(payload)
  })

  it('propagates fetch errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(refreshAuth('token')).rejects.toThrow('Network error')
  })
})

describe('getAuthUser', () => {
  it('gets /auth/me and returns mapped UserLoginDto', async () => {
    const raw = makeRawUserLogin({ username: 'me', firstName: 'Current' })
    mockedGet.mockResolvedValue({ data: raw })

    const result = await getAuthUser()

    expect(mockedGet).toHaveBeenCalledWith(
      'https://api.test/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(result.username).toBe('me')
    expect(result.firstName).toBe('Current')
  })
})
