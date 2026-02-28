import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLoginUserStore } from '@/stores/loginUserStore'

const REFRESH_TOKEN_KEY = 'RefreshToken'

vi.mock('@/api/userApi', () => ({
  login: vi.fn(),
  refreshAuth: vi.fn(),
  getAuthUser: vi.fn(),
}))

import { login as apiLogin, refreshAuth, getAuthUser } from '@/api/userApi'

const mockedLogin = vi.mocked(apiLogin)
const mockedRefreshAuth = vi.mocked(refreshAuth)
const mockedGetAuthUser = vi.mocked(getAuthUser)

function makeUser(overrides: Partial<{
  id: number
  username: string
  firstName: string
  lastName: string
  gender: string
  image: string
  accessToken: string
  refreshToken: string
}> = {}) {
  return {
    id: 1,
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    gender: 'male',
    image: '',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    ...overrides,
  }
}

const mockLocalStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key]
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(mockLocalStorage)) delete mockLocalStorage[key]
  }),
  get length() {
    return Object.keys(mockLocalStorage).length
  },
  key: vi.fn(() => null),
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
  setActivePinia(createPinia())
})

describe('loginUserStore', () => {
  describe('initial state', () => {
    it('user is undefined', () => {
      const store = useLoginUserStore()
      expect(store.user).toBeUndefined()
    })

    it('accessToken getter returns null when no user', () => {
      const store = useLoginUserStore()
      expect(store.accessToken).toBeNull()
    })

    it('fullName getter returns empty string when no user', () => {
      const store = useLoginUserStore()
      expect(store.fullName).toBe('')
    })
  })

  describe('fullName getter', () => {
    it('returns firstName and lastName joined when both present', () => {
      const store = useLoginUserStore()
      store.user = makeUser({ firstName: 'Alice', lastName: 'Smith' })
      expect(store.fullName).toBe('Alice Smith')
    })

    it('returns username when firstName and lastName are empty', () => {
      const store = useLoginUserStore()
      store.user = makeUser({ firstName: '', lastName: '', username: 'alice' })
      expect(store.fullName).toBe('alice')
    })
  })

  describe('login', () => {
    it('calls api login and sets user and localStorage', async () => {
      const store = useLoginUserStore()
      const user = makeUser({ username: 'alice', refreshToken: 'rt-123' })
      mockedLogin.mockResolvedValue(user)

      await store.login('alice', 'password')

      expect(mockedLogin).toHaveBeenCalledWith('alice', 'password')
      expect(store.user).toEqual(user)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'rt-123')
    })
  })

  describe('refreshTokens', () => {
    it('returns false when no refresh token in localStorage', async () => {
      const store = useLoginUserStore()

      const result = await store.refreshTokens()

      expect(result).toBe(false)
      expect(mockedRefreshAuth).not.toHaveBeenCalled()
    })

    it('calls refreshAuth and updates user tokens on success', async () => {
      const store = useLoginUserStore()
      store.user = makeUser()
      mockLocalStorage[REFRESH_TOKEN_KEY] = 'old-refresh'
      mockedRefreshAuth.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      })

      const result = await store.refreshTokens()

      expect(result).toBe(true)
      expect(mockedRefreshAuth).toHaveBeenCalledWith('old-refresh')
      expect(store.user!.accessToken).toBe('new-access')
      expect(store.user!.refreshToken).toBe('new-refresh')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'new-refresh')
    })

    it('uses makeUserWithTokens when user was undefined before refresh', async () => {
      const store = useLoginUserStore()
      mockLocalStorage[REFRESH_TOKEN_KEY] = 'stored-refresh'
      mockedRefreshAuth.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      })

      const result = await store.refreshTokens()

      expect(result).toBe(true)
      expect(store.user).toBeDefined()
      expect(store.user!.accessToken).toBe('new-access')
      expect(store.user!.refreshToken).toBe('new-refresh')
      expect(store.user!.username).toBe('')
      expect(store.user!.firstName).toBe('')
    })

    it('returns false and does not update when refreshAuth throws', async () => {
      const store = useLoginUserStore()
      store.user = makeUser({ accessToken: 'old' })
      mockLocalStorage[REFRESH_TOKEN_KEY] = 'old-refresh'
      mockedRefreshAuth.mockRejectedValue(new Error('Invalid token'))

      const result = await store.refreshTokens()

      expect(result).toBe(false)
      expect(store.user!.accessToken).toBe('old')
    })
  })

  describe('clearUserCredentials', () => {
    it('clears user and removes refresh token from localStorage', () => {
      const store = useLoginUserStore()
      store.user = makeUser()
      mockLocalStorage[REFRESH_TOKEN_KEY] = 'x'

      store.clearUserCredentials()

      expect(store.user).toBeUndefined()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY)
    })
  })

  describe('fetchAuthorizedUser', () => {
    it('calls getAuthUser and merges result with current accessToken and stored refreshToken', async () => {
      const store = useLoginUserStore()
      store.user = makeUser({ accessToken: 'current-access' })
      mockLocalStorage[REFRESH_TOKEN_KEY] = 'stored-refresh'
      const profile = makeUser({
        id: 2,
        username: 'me',
        firstName: 'Profile',
        lastName: 'User',
        accessToken: '',
        refreshToken: '',
      })
      mockedGetAuthUser.mockResolvedValue(profile)

      await store.fetchAuthorizedUser()

      expect(mockedGetAuthUser).toHaveBeenCalledTimes(1)
      expect(store.user).toEqual({
        ...profile,
        accessToken: 'current-access',
        refreshToken: 'stored-refresh',
      })
    })

    it('throws when getAuthUser fails', async () => {
      const store = useLoginUserStore()
      store.user = makeUser()
      mockLocalStorage[REFRESH_TOKEN_KEY] = 'r'
      mockedGetAuthUser.mockRejectedValue(new Error('401'))

      await expect(store.fetchAuthorizedUser()).rejects.toThrow('401')
    })
  })
})
