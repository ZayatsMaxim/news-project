import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePostsListStore, POSTS_PAGE_LIMIT } from '@/stores/postsListStore'

vi.mock('@/api/postApi', () => ({
  getPosts: vi.fn(),
}))

vi.mock('@/api/mappers/postMapper', () => ({
  mapPostsListToDto: vi.fn((raw: unknown[]) => raw as PostDto[]),
}))

import { getPosts } from '@/api/postApi'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'

const mockedGetPosts = vi.mocked(getPosts)

function makePost(id: number, title = 'Post'): PostDto {
  return { id, title, body: 'body', userId: 1, views: 0, reactions: { likes: 0, dislikes: 0 } }
}

function makeResponse(posts: PostDto[]): PostResponseDto {
  return { posts }
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
      expect(store.totalPages).toBe(1)
      expect(store.limit).toBe(POSTS_PAGE_LIMIT)
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
      store.totalPages = 3
      expect(store.pagesAmount).toBe(3)
    })
  })

  describe('fetchPosts', () => {
    it('fetches posts and updates state', async () => {
      const store = usePostsListStore()
      const posts = [makePost(1), makePost(2)]
      mockedGetPosts.mockResolvedValue(makeResponse(posts))

      await store.fetchPosts()

      expect(store.posts).toEqual(posts)
      expect(store.total).toBe(posts.length)
      expect(store.isLoading).toBe(false)
    })

    it('uses total and totalPages from API (e.g. X-Total-Count and Link) when provided', async () => {
      const store = usePostsListStore()
      const posts = [makePost(1)]
      mockedGetPosts.mockResolvedValue({ posts, total: 100, totalPages: 12 })

      await store.fetchPosts()

      expect(store.posts).toEqual(posts)
      expect(store.total).toBe(100)
      expect(store.totalPages).toBe(12)
    })

    it('sets isLoading true during fetch', async () => {
      const store = usePostsListStore()
      let loadingDuringFetch = false
      mockedGetPosts.mockImplementation(() => {
        loadingDuringFetch = store.isLoading
        return Promise.resolve(makeResponse([]))
      })

      await store.fetchPosts()

      expect(loadingDuringFetch).toBe(true)
      expect(store.isLoading).toBe(false)
    })

    it('resets page to 1 when resetPage is true', async () => {
      const store = usePostsListStore()
      store.page = 3
      mockedGetPosts.mockResolvedValue(makeResponse([makePost(1)]))

      await store.fetchPosts({ resetPage: true })

      expect(store.page).toBe(1)
    })

    it('keeps page when resetPage is false', async () => {
      const store = usePostsListStore()
      store.page = 3
      mockedGetPosts.mockResolvedValue(makeResponse([makePost(1)]))

      await store.fetchPosts()

      expect(store.page).toBe(3)
    })

    it('aborts previous request when new one is made', async () => {
      const store = usePostsListStore()
      const abortCalls: AbortSignal[] = []

      mockedGetPosts.mockImplementation(async (params) => {
        abortCalls.push(params.signal!)
        return makeResponse([])
      })

      const p1 = store.fetchPosts()
      const p2 = store.fetchPosts()
      await Promise.all([p1, p2])

      expect(abortCalls[0]!.aborted).toBe(true)
    })

    it('saves to sessionStorage after successful fetch', async () => {
      const store = usePostsListStore()
      const posts = [makePost(1)]
      mockedGetPosts.mockResolvedValue({ posts, totalPages: 1 })

      await store.fetchPosts()

      expect(sessionStorageMock.setItem).toHaveBeenCalledTimes(1)
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('posts_list_store_state', expect.any(String))
      const stored = JSON.parse(sessionStorageMock.setItem.mock.calls[0]![1]) as { posts: unknown[]; total: number; totalPages: number }
      expect(stored.posts).toHaveLength(1)
      expect(stored.total).toBe(1)
      expect(stored.totalPages).toBe(1)
    })

    it('catches and logs when sessionStorage.setItem throws', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([makePost(1)]))
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
        return makeResponse([makePost(1)])
      })

      const p1 = store.fetchPosts()
      await new Promise((r) => setTimeout(r, 10))
      const p2 = store.fetchPosts()
      await Promise.all([p1, p2])

      expect(capturedSignal!.aborted).toBe(true)
      expect(store.posts).toEqual([makePost(1)])
      expect(store.total).toBe(1)
      expect(store.totalPages).toBe(1)
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
      expect(store.totalPages).toBe(1)
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

      try {
        await store.fetchPosts()
      } catch {
        // expected rejection
      }

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('searchPosts', () => {
    it('sets query, searchField and fetches with resetPage', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([]))

      await store.searchPosts('hello', 'body')

      expect(store.query).toBe('hello')
      expect(store.searchField).toBe('body')
      const callParams = mockedGetPosts.mock.calls[0]![0]
      expect(callParams.query).toBe('hello')
    })

    it('trims the query', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([]))

      await store.searchPosts('  test  ')

      expect(store.query).toBe('test')
    })

    it('keeps existing searchField when none provided', async () => {
      const store = usePostsListStore()
      store.searchField = 'userId'
      mockedGetPosts.mockResolvedValue(makeResponse([]))

      await store.searchPosts('42')

      expect(store.searchField).toBe('userId')
    })
  })

  describe('loadPage', () => {
    it('sets page and fetches', async () => {
      const store = usePostsListStore()
      mockedGetPosts.mockResolvedValue(makeResponse([]))

      await store.loadPage(3)

      expect(store.page).toBe(3)
      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
      const callParams = mockedGetPosts.mock.calls[0]![0]
      expect(callParams._page).toBe(3)
    })
  })

  describe('ensurePostsLoaded', () => {
    it('hydrates from storage if available', async () => {
      const store = usePostsListStore()
      const saved = {
        posts: [makePost(1)],
        total: 1,
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
      mockedGetPosts.mockResolvedValue(makeResponse([makePost(1)]))

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
        totalPages: 2,
        page: 2,
        query: 'test',
        searchField: 'body',
      }
      mockSessionStorage['posts_list_store_state'] = JSON.stringify(saved)

      const result = store.hydrateFromStorage()

      expect(result).toBe(true)
      expect(store.total).toBe(10)
      expect(store.totalPages).toBe(2)
      expect(store.page).toBe(2)
      expect(store.query).toBe('test')
      expect(store.searchField).toBe('body')
    })

    it('falls back to defaults for invalid fields', () => {
      const store = usePostsListStore()
      mockSessionStorage['posts_list_store_state'] = JSON.stringify({
        posts: 'not-array',
        total: 'bad',
        totalPages: 'bad',
        page: null,
        query: 123,
        searchField: 'invalid',
      })

      store.hydrateFromStorage()

      expect(store.posts).toEqual([])
      expect(store.total).toBe(0)
      expect(store.totalPages).toBe(1)
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

    it('saves to sessionStorage after updating post', () => {
      const store = usePostsListStore()
      store.posts = [makePost(1, 'Old'), makePost(2, 'Other')]
      store.page = 1
      store.query = 'test'
      store.searchField = 'title'
      store.total = 2
      store.totalPages = 1

      store.updatePostInList(1, { title: 'New', body: 'Updated body' })

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('posts_list_store_state', expect.any(String))
      const stored = JSON.parse(sessionStorageMock.setItem.mock.calls[0]![1]) as { posts: { id: number; title: string; body: string }[] }
      expect(stored.posts).toHaveLength(2)
      expect(stored.posts[0]!.title).toBe('New')
      expect(stored.posts[0]!.body).toBe('Updated body')
    })
  })

  describe('refreshPosts', () => {
    it('fetches without resetting page', async () => {
      const store = usePostsListStore()
      store.page = 3
      mockedGetPosts.mockResolvedValue(makeResponse([]))

      await store.refreshPosts()

      expect(store.page).toBe(3)
      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
      const callParams = mockedGetPosts.mock.calls[0]![0]
      expect(callParams._page).toBe(3)
    })
  })
})
