import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePostsCoordinator } from '@/composables/usePostsCoordinator'
import { usePostsListStore } from '@/stores/postsListStore'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import type { PostDto } from '@/dto/post/postDto'

vi.mock('@/api/postApi', () => ({
  getPosts: vi.fn(),
  getPostById: vi.fn(),
  getPostComments: vi.fn(),
  patchPost: vi.fn(),
}))

vi.mock('@/api/userApi', () => ({
  getUser: vi.fn(),
}))

vi.mock('@/api/postLocalTitleSearch', () => ({
  searchByTitleLocal: vi.fn(),
  invalidateLocalPostsCache: vi.fn(),
}))

vi.mock('@/api/mappers/postMapper', () => ({
  mapPostsListToDto: vi.fn((raw: unknown[]) => raw as import('@/dto/post/postDto').PostDto[]),
}))

import { getPosts, getPostById, getPostComments, patchPost } from '@/api/postApi'
import { getUser } from '@/api/userApi'

const mockedGetPosts = vi.mocked(getPosts)
const mockedGetPostById = vi.mocked(getPostById)
const mockedGetPostComments = vi.mocked(getPostComments)
const mockedPatchPost = vi.mocked(patchPost)
const mockedGetUser = vi.mocked(getUser)

function makePost(id: number, title = 'Post', body = 'Body'): PostDto {
  return { id, title, body, userId: 10, views: 100, reactions: { likes: 1, dislikes: 0 } }
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

describe('usePostsCoordinator', () => {
  describe('hasPrevPost', () => {
    it('returns false when modalPostPosition is 0', () => {
      const { hasPrevPost } = usePostsCoordinator()
      const detailsStore = usePostDetailsStore()
      detailsStore.modalPostPosition = 0

      expect(hasPrevPost.value).toBe(false)
    })

    it('returns false when modalPostPosition is 1', () => {
      const { hasPrevPost } = usePostsCoordinator()
      const detailsStore = usePostDetailsStore()
      detailsStore.modalPostPosition = 1

      expect(hasPrevPost.value).toBe(false)
    })

    it('returns true when modalPostPosition > 1', () => {
      const { hasPrevPost } = usePostsCoordinator()
      const detailsStore = usePostDetailsStore()
      detailsStore.modalPostPosition = 3

      expect(hasPrevPost.value).toBe(true)
    })
  })

  describe('hasNextPost', () => {
    it('returns false when total is 0', () => {
      const { hasNextPost } = usePostsCoordinator()

      expect(hasNextPost.value).toBe(false)
    })

    it('returns false when at last post', () => {
      const { hasNextPost } = usePostsCoordinator()
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      listStore.total = 10
      detailsStore.modalPostPosition = 10

      expect(hasNextPost.value).toBe(false)
    })

    it('returns true when not at last post', () => {
      const { hasNextPost } = usePostsCoordinator()
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      listStore.total = 10
      detailsStore.modalPostPosition = 5

      expect(hasNextPost.value).toBe(true)
    })
  })

  describe('openPostForModal', () => {
    it('calls loadPostForModal with correct position and search context', async () => {
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      listStore.page = 2
      listStore.query = 'vue'
      listStore.searchField = 'title'

      const loadSpy = vi.spyOn(detailsStore, 'loadPostForModal').mockResolvedValue()
      const { openPostForModal } = usePostsCoordinator()

      openPostForModal(42, 2)

      expect(loadSpy).toHaveBeenCalledWith(12, 42, { query: 'vue', field: 'title' })
    })

    it('returns promise that rejects when loadPostForModal throws', async () => {
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      listStore.page = 1
      vi.spyOn(detailsStore, 'loadPostForModal').mockRejectedValue(new Error('Load failed'))

      const { openPostForModal } = usePostsCoordinator()

      await expect(openPostForModal(1, 0)).rejects.toThrow('Load failed')
    })
  })

  describe('searchPosts', () => {
    it('clears details cache and searches', async () => {
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      detailsStore.postDetailsCache = [{ post: makePost(1), user: null, comments: [] }]

      mockedGetPosts.mockResolvedValue({ posts: [] })
      const { searchPosts } = usePostsCoordinator()

      await searchPosts('test', 'body')

      expect(detailsStore.postDetailsCache).toEqual([])
      expect(listStore.query).toBe('test')
      expect(listStore.searchField).toBe('body')
      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
      const callArg = mockedGetPosts.mock.calls[0]![0]
      expect(callArg.query).toBe('test')
      expect(callArg.field).toBe('body')
    })

    it('searches by title when field is "title"', async () => {
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      detailsStore.postDetailsCache = [{ post: makePost(1), user: null, comments: [] }]
      mockedGetPosts.mockResolvedValue({ posts: [makePost(1)] })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('vue', 'title')

      expect(detailsStore.postDetailsCache).toEqual([])
      expect(listStore.query).toBe('vue')
      expect(listStore.searchField).toBe('title')
      expect(listStore.page).toBe(1)
      expect(listStore.skip).toBe(0)
      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
      const callArg = mockedGetPosts.mock.calls[0]![0]
      expect(callArg.query).toBe('vue')
      expect(callArg.field).toBe('title')
      expect(callArg._page).toBe(1)
    })

    it('searches by body when field is "body"', async () => {
      const listStore = usePostsListStore()
      const matchingPost = makePost(1, 'Some Title', 'This post contains hello world in the body.')
      mockedGetPosts.mockResolvedValue({
        posts: [matchingPost],
        total: 1,
      })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('hello world', 'body')

      expect(mockedGetPosts).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'hello world', field: 'body' }),
      )
      expect(listStore.posts).toHaveLength(1)
      expect(listStore.total).toBe(1)
      expect(listStore.posts[0]!.body).toContain('hello world')
      expect(listStore.posts[0]!.id).toBe(1)
      expect(listStore.posts[0]!.body).toBe('This post contains hello world in the body.')
    })

    it('searches by userId when field is "userId"', async () => {
      const listStore = usePostsListStore()
      mockedGetPosts.mockResolvedValue({ posts: [makePost(1)], total: 1 })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('42', 'userId')

      expect(listStore.query).toBe('42')
      expect(listStore.searchField).toBe('userId')
      const callArg = mockedGetPosts.mock.calls[0]![0]
      expect(callArg.query).toBe('42')
      expect(callArg.field).toBe('userId')
    })

    it('trims query before searching', async () => {
      const listStore = usePostsListStore()
      mockedGetPosts.mockResolvedValue({ posts: [], total: 0 })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('  spaces  ', 'body')

      expect(listStore.query).toBe('spaces')
      const callArg = mockedGetPosts.mock.calls[0]![0]
      expect(callArg.query).toBe('spaces')
    })

    it('uses default field "title" when field is not provided', async () => {
      const listStore = usePostsListStore()
      mockedGetPosts.mockResolvedValue({ posts: [], total: 0 })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('vue')

      expect(listStore.query).toBe('vue')
      expect(listStore.searchField).toBe('title')
      const callArg = mockedGetPosts.mock.calls[0]![0]
      expect(callArg.field).toBe('title')
    })

    it('keeps previous searchField when field is omitted', async () => {
      const listStore = usePostsListStore()
      listStore.searchField = 'userId'
      mockedGetPosts.mockResolvedValue({ posts: [], total: 0 })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('next')

      expect(listStore.query).toBe('next')
      expect(listStore.searchField).toBe('userId')
      const callArg = mockedGetPosts.mock.calls[0]![0]
      expect(callArg.field).toBe('userId')
    })

    it('rethrows when listStore.searchPosts throws', async () => {
      mockedGetPosts.mockRejectedValue(new Error('API error'))

      const { searchPosts } = usePostsCoordinator()

      await expect(searchPosts('test', 'title')).rejects.toThrow('API error')
    })

    it('resets page to 1 on new search', async () => {
      const listStore = usePostsListStore()
      listStore.page = 3
      mockedGetPosts.mockResolvedValue({ posts: [] })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('new', 'title')

      expect(listStore.page).toBe(1)
      expect(listStore.skip).toBe(0)
      // getPosts is called with current page (3) before response; after response we set page to 1
      const callArg = mockedGetPosts.mock.calls[0]![0]
      expect(callArg._page).toBe(3)
    })

    it('updates list state from search result', async () => {
      const listStore = usePostsListStore()
      const posts = [makePost(1, 'A'), makePost(2, 'B')]
      mockedGetPosts.mockResolvedValue({ posts, total: 2 })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('test', 'body')

      expect(listStore.posts).toHaveLength(2)
      expect(listStore.posts[0]!.title).toBe('A')
      expect(listStore.posts[1]!.title).toBe('B')
      expect(listStore.total).toBe(2)
    })

    it('saves into store only posts matching the search query', async () => {
      const listStore = usePostsListStore()
      const filteredPosts = [makePost(1, 'Vue 3 Guide', 'Intro to Vue')]
      mockedGetPosts.mockResolvedValue({
        posts: filteredPosts,
        total: 1,
      })

      const { searchPosts } = usePostsCoordinator()
      await searchPosts('vue', 'title')

      expect(mockedGetPosts).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'vue', field: 'title' }),
      )
      expect(listStore.posts).toHaveLength(1)
      expect(listStore.total).toBe(1)
      expect(listStore.posts[0]!.title).toBe('Vue 3 Guide')
    })
  })

  describe('refreshPosts', () => {
    it('clears details cache and refreshes list', async () => {
      const detailsStore = usePostDetailsStore()
      detailsStore.postDetailsCache = [{ post: makePost(1), user: null, comments: [] }]

      mockedGetPosts.mockResolvedValue({ posts: [] })
      const { refreshPosts } = usePostsCoordinator()

      await refreshPosts()

      expect(detailsStore.postDetailsCache).toEqual([])
      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
    })
  })

  describe('saveAndSync', () => {
    it('saves changes and updates post in list', async () => {
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      const post = makePost(1, 'New Title', 'New Body')
      detailsStore.postDetailsCache = [{ post, user: null, comments: [] }]
      detailsStore.modalRequestedPostId = 1
      listStore.posts = [makePost(1, 'Old Title', 'Old Body')]

      mockedPatchPost.mockResolvedValue(makePost(1, 'New Title', 'New Body'))
      const { saveAndSync } = usePostsCoordinator()

      const result = await saveAndSync(1)

      expect(result).toBe(true)
      expect(listStore.posts[0]!.title).toBe('New Title')
      expect(listStore.posts[0]!.body).toBe('New Body')
    })

    it('returns false when save fails', async () => {
      const detailsStore = usePostDetailsStore()
      const { saveAndSync } = usePostsCoordinator()

      const result = await saveAndSync(999)

      expect(result).toBe(false)
    })

    it('rethrows when detailsStore.saveChanges throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const detailsStore = usePostDetailsStore()
      const post = makePost(1)
      detailsStore.postDetailsCache = [{ post, user: null, comments: [] }]
      detailsStore.modalRequestedPostId = 1
      mockedPatchPost.mockRejectedValue(new Error('Patch failed'))

      const { saveAndSync } = usePostsCoordinator()

      await expect(saveAndSync(1)).rejects.toThrow('Patch failed')
      consoleSpy.mockRestore()
    })
  })

  describe('goToPrevPost', () => {
    it('loads previous post by decrementing position', async () => {
      const detailsStore = usePostDetailsStore()
      detailsStore.modalPostPosition = 5

      const loadSpy = vi.spyOn(detailsStore, 'loadPostForModal').mockResolvedValue()
      const { goToPrevPost } = usePostsCoordinator()

      await goToPrevPost()

      expect(loadSpy).toHaveBeenCalledWith(
        4,
        undefined,
        expect.objectContaining({ query: '', field: 'title' }),
      )
    })

    it('does nothing when already at first post', async () => {
      const detailsStore = usePostDetailsStore()
      detailsStore.modalPostPosition = 1

      const loadSpy = vi.spyOn(detailsStore, 'loadPostForModal').mockResolvedValue()
      const { goToPrevPost } = usePostsCoordinator()

      await goToPrevPost()

      expect(loadSpy).not.toHaveBeenCalled()
    })
  })

  describe('goToNextPost', () => {
    it('loads next post by incrementing position', async () => {
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      listStore.total = 10
      detailsStore.modalPostPosition = 5

      const loadSpy = vi.spyOn(detailsStore, 'loadPostForModal').mockResolvedValue()
      const { goToNextPost } = usePostsCoordinator()

      await goToNextPost()

      expect(loadSpy).toHaveBeenCalledWith(
        6,
        undefined,
        expect.objectContaining({ query: '', field: 'title' }),
      )
    })

    it('does nothing when already at last post', async () => {
      const listStore = usePostsListStore()
      const detailsStore = usePostDetailsStore()
      listStore.total = 10
      detailsStore.modalPostPosition = 10

      const loadSpy = vi.spyOn(detailsStore, 'loadPostForModal').mockResolvedValue()
      const { goToNextPost } = usePostsCoordinator()

      await goToNextPost()

      expect(loadSpy).not.toHaveBeenCalled()
    })
  })
})
