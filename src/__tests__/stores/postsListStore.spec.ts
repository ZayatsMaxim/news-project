import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePostsListStore } from '@/stores/postsListStore'

vi.mock('@/api/postApi', () => ({
  getPosts: vi.fn(),
}))

vi.mock('@/api/mappers/postMapper', () => ({
  normalizePostList: vi.fn((raw: unknown[]) => raw),
}))

import { getPosts } from '@/api/postApi'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'

const mockedGetPosts = vi.mocked(getPosts)

function makePost(id: number, title = 'Post'): PostDto {
  return { id, title, body: 'body', userId: 1, views: 0, reactions: { likes: 0, dislikes: 0 } }
}

function makeResponse(posts: PostDto[], total: number, skip = 0, limit = 9): PostResponseDto {
  return { posts, total, skip, limit }
}

const mockSessionStorage: Record<string, string> = {}
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockSessionStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionStorage[key]
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(mockSessionStorage)) delete mockSessionStorage[key]
  }),
  get length() {
    return Object.keys(mockSessionStorage).length
  },
  key: vi.fn(() => null),
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorageMock.clear()
  Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true })
  setActivePinia(createPinia())
})

describe('postsListStore', () => {
  describe('initial state', () => {
    it('has correct defaults', () => {
      const store = usePostsListStore()

      expect(store.posts).toEqual([])
      expect(store.total).toBe(0)
      expect(store.skip).toBe(0)
      expect(store.limit).toBe(9)
      expect(store.page).toBe(1)
      expect(store.query).toBe('')
      expect(store.searchField).toBe('title')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('getters', () => {
    it('pagesAmount returns at least 1', () => {
      const store = usePostsListStore()
      expect(store.pagesAmount).toBe(1)
    })

    it('pagesAmount calculates correctly', () => {
      const store = usePostsListStore()
      store.total = 25
      store.limit = 9
      expect(store.pagesAmount).toBe(3)
    })

    it('requiredSkipAmount calculates from page and limit', () => {
      const store = usePostsListStore()
      store.page = 3
      store.limit = 9
      expect(store.requiredSkipAmount).toBe(18)
    })
  })

  describe('fetchPosts', () => {
    it('fetches posts and updates state', async () => {
      const store = usePostsListStore()
      const posts = [makePost(1), makePost(2)]
      mockedGetPosts.mockResolvedValue(makeResponse(posts, 20, 0, 9))

      await store.fetchPosts()

      expect(store.posts).toEqual(posts)
      expect(store.total).toBe(20)
      expect(store.isLoading).toBe(false)
    })

    it('sets isLoading true during fetch', async () => {
      const store = usePostsListStore()
      let loadingDuringFetch = false
      mockedGetPosts.mockImplementation(() => {
        loadingDuringFetch = store.isLoading
        return Promise.resolve(makeResponse([], 0))
      })

      await store.fetchPosts()

      expect(loadingDuringFetch).toBe(true)
      expect(store.isLoading).toBe(false)
    })

    it('resets page to 1 when resetPage is true', async () => {
      const store = usePostsListStore()
      store.page = 3
      store.skip = 18
      mockedGetPosts.mockResolvedValue(makeResponse([makePost(1)], 10, 0, 9))

      await store.fetchPosts({ resetPage: true })

      expect(store.page).toBe(1)
      expect(store.skip).toBe(0)
    })

    it('calculates page from skip when resetPage is false', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([makePost(1)], 30, 18, 9))

      await store.fetchPosts()

      expect(store.page).toBe(3)
      expect(store.skip).toBe(18)
    })

    it('aborts previous request when new one is made', async () => {
      const store = usePostsListStore()
      const abortCalls: AbortSignal[] = []

      mockedGetPosts.mockImplementation(async (params) => {
        abortCalls.push(params.signal!)
        return makeResponse([], 0)
      })

      const p1 = store.fetchPosts()
      const p2 = store.fetchPosts()
      await Promise.all([p1, p2])

      expect(abortCalls[0]!.aborted).toBe(true)
    })

    it('saves to sessionStorage after successful fetch', async () => {
      const store = usePostsListStore()
      const posts = [makePost(1)]
      mockedGetPosts.mockResolvedValue(makeResponse(posts, 1))

      await store.fetchPosts()

      expect(sessionStorageMock.setItem).toHaveBeenCalledTimes(1)
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('posts_list_store_state', expect.any(String))
      const stored = JSON.parse(sessionStorageMock.setItem.mock.calls[0]![1]) as { posts: unknown[]; total: number }
      expect(stored.posts).toHaveLength(1)
      expect(stored.total).toBe(1)
    })

    it('catches and logs when sessionStorage.setItem throws', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([makePost(1)], 1))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      sessionStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceeded')
      })

      await store.fetchPosts()

      expect(warnSpy).toHaveBeenCalledWith('Failed to save to sessionStorage', expect.any(Error))
      warnSpy.mockRestore()
    })

    it('does not update state if signal was aborted before response is applied', async () => {
      const store = usePostsListStore()
      store.posts = [makePost(99)]
      let capturedSignal: AbortSignal | undefined

      let callCount = 0
      mockedGetPosts.mockImplementation(async (params) => {
        callCount++
        if (callCount === 1) {
          capturedSignal = params.signal
          await new Promise((r) => setTimeout(r, 50))
        }
        return makeResponse([makePost(1)], 1)
      })

      const p1 = store.fetchPosts()
      await new Promise((r) => setTimeout(r, 10))
      const p2 = store.fetchPosts()
      await Promise.all([p1, p2])

      expect(capturedSignal!.aborted).toBe(true)
      expect(store.posts).toEqual([makePost(1)])
      expect(store.total).toBe(1)
    })

    it('handles fetch errors by rethrowing', async () => {
      const store = usePostsListStore()
      const networkError = new Error('Network error')
      mockedGetPosts.mockRejectedValue(networkError)

      await expect(store.fetchPosts()).rejects.toThrow('Network error')
      expect(store.isLoading).toBe(false)
    })

    it('on 404 with searchField userId sets empty list and does not throw', async () => {
      const store = usePostsListStore()
      store.searchField = 'userId'
      store.query = '999'
      const err = new Error('Failed to fetch: 404') as Error & { status?: number }
      err.status = 404
      mockedGetPosts.mockRejectedValue(err)

      await store.fetchPosts()

      expect(store.posts).toEqual([])
      expect(store.total).toBe(0)
      expect(store.skip).toBe(0)
      expect(store.page).toBe(1)
      expect(sessionStorageMock.setItem).toHaveBeenCalled()
    })

    it('on 404 with searchField title rethrows', async () => {
      const store = usePostsListStore()
      store.searchField = 'title'
      const err = new Error('Failed to fetch: 404') as Error & { status?: number }
      err.status = 404
      mockedGetPosts.mockRejectedValue(err)

      await expect(store.fetchPosts()).rejects.toThrow('Failed to fetch: 404')
    })

    it('does not log AbortError', async () => {
      const store = usePostsListStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockedGetPosts.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

      await store.fetchPosts()

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('searchPosts', () => {
    it('sets query, searchField and fetches with resetPage', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([], 0))

      await store.searchPosts('hello', 'body')

      expect(store.query).toBe('hello')
      expect(store.searchField).toBe('body')
      const callParams = mockedGetPosts.mock.calls[0]![0]
      expect(callParams.query).toBe('hello')
    })

    it('trims the query', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([], 0))

      await store.searchPosts('  test  ')

      expect(store.query).toBe('test')
    })

    it('keeps existing searchField when none provided', async () => {
      const store = usePostsListStore()
      store.searchField = 'userId'
      mockedGetPosts.mockResolvedValue(makeResponse([], 0))

      await store.searchPosts('42')

      expect(store.searchField).toBe('userId')
    })
  })

  describe('loadPage', () => {
    it('sets page and skip, then fetches', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([], 0, 18, 9))

      await store.loadPage(3)

      expect(store.page).toBe(3)
      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
    })
  })

  describe('ensurePostsLoaded', () => {
    it('hydrates from storage if available', async () => {
      const store = usePostsListStore()
      const saved = {
        posts: [makePost(1)],
        total: 1,
        skip: 0,
        page: 1,
        query: '',
        searchField: 'title',
      }
      mockSessionStorage['posts_list_store_state'] = JSON.stringify(saved)

      await store.ensurePostsLoaded()

      expect(mockedGetPosts).not.toHaveBeenCalled()
      expect(store.posts).toHaveLength(1)
    })

    it('fetches when storage is empty', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([makePost(1)], 1))

      await store.ensurePostsLoaded()

      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
    })
  })

  describe('hydrateFromStorage', () => {
    it('returns false when storage is empty', () => {
      const store = usePostsListStore()
      expect(store.hydrateFromStorage()).toBe(false)
    })

    it('restores state from valid JSON', () => {
      const store = usePostsListStore()
      const saved = {
        posts: [makePost(5, 'Saved')],
        total: 10,
        skip: 9,
        page: 2,
        query: 'test',
        searchField: 'body',
      }
      mockSessionStorage['posts_list_store_state'] = JSON.stringify(saved)

      const result = store.hydrateFromStorage()

      expect(result).toBe(true)
      expect(store.total).toBe(10)
      expect(store.page).toBe(2)
      expect(store.query).toBe('test')
      expect(store.searchField).toBe('body')
    })

    it('falls back to defaults for invalid fields', () => {
      const store = usePostsListStore()
      mockSessionStorage['posts_list_store_state'] = JSON.stringify({
        posts: 'not-array',
        total: 'bad',
        page: null,
        query: 123,
        searchField: 'invalid',
      })

      store.hydrateFromStorage()

      expect(store.posts).toEqual([])
      expect(store.total).toBe(0)
      expect(store.page).toBe(1)
      expect(store.query).toBe('')
      expect(store.searchField).toBe('title')
    })

    it('returns false on corrupt JSON', () => {
      const store = usePostsListStore()
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockSessionStorage['posts_list_store_state'] = '{corrupt'

      expect(store.hydrateFromStorage()).toBe(false)
      consoleSpy.mockRestore()
    })
  })

  describe('updatePostInList', () => {
    it('updates title and body of matching post', () => {
      const store = usePostsListStore()
      store.posts = [makePost(1, 'Old'), makePost(2, 'Other')]

      store.updatePostInList(1, { title: 'New', body: 'Updated body' })

      expect(store.posts[0]!.title).toBe('New')
      expect(store.posts[0]!.body).toBe('Updated body')
    })

    it('updates only title when body is undefined', () => {
      const store = usePostsListStore()
      store.posts = [makePost(1, 'Old')]

      store.updatePostInList(1, { title: 'New' })

      expect(store.posts[0]!.title).toBe('New')
      expect(store.posts[0]!.body).toBe('body')
    })

    it('does nothing if post not found', () => {
      const store = usePostsListStore()
      store.posts = [makePost(1)]

      store.updatePostInList(999, { title: 'X' })

      expect(store.posts[0]!.title).toBe('Post')
    })
  })

  describe('refreshPosts', () => {
    it('fetches without resetting page', async () => {
      const store = usePostsListStore()
      store.page = 3
      store.skip = 18
      mockedGetPosts.mockResolvedValue(makeResponse([], 0, 18, 9))

      await store.refreshPosts()

      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
      const callParams = mockedGetPosts.mock.calls[0]![0]
      expect(callParams.skip).toBe(18)
    })
  })
})
