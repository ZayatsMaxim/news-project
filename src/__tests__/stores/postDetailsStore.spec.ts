import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import type { PostDto } from '@/dto/post/postDto'

vi.mock('@/api/postApi', () => ({
  getPostById: vi.fn(),
  getPosts: vi.fn(),
  getPostComments: vi.fn(),
  patchPost: vi.fn(),
  patchPostViews: vi.fn(),
  patchPostReactions: vi.fn(),
  patchCommentLikes: vi.fn(),
  createPost: vi.fn(),
}))

vi.mock('@/api/userApi', () => ({
  getUser: vi.fn(),
}))

vi.mock('@/stores/loginUserStore', () => ({
  useLoginUserStore: vi.fn(),
}))

import { getPostById, getPosts, getPostComments, patchPost, patchPostViews, patchPostReactions, patchCommentLikes, createPost } from '@/api/postApi'
import { getUser } from '@/api/userApi'
import { useLoginUserStore } from '@/stores/loginUserStore'

const mockedUseLoginUserStore = vi.mocked(useLoginUserStore)

const mockedGetPostById = vi.mocked(getPostById)
const mockedGetPosts = vi.mocked(getPosts)
const mockedGetPostComments = vi.mocked(getPostComments)
const mockedPatchPost = vi.mocked(patchPost)
const mockedPatchPostViews = vi.mocked(patchPostViews)
const mockedPatchPostReactions = vi.mocked(patchPostReactions)
const mockedPatchCommentLikes = vi.mocked(patchCommentLikes)
const mockedCreatePost = vi.mocked(createPost)
const mockedGetUser = vi.mocked(getUser)

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
    for (const k of Object.keys(mockSessionStorage)) delete mockSessionStorage[k]
  }),
  get length() {
    return Object.keys(mockSessionStorage).length
  },
  key: vi.fn(() => null),
}

function makePost(id: number, title = 'Post', body = 'Body'): PostDto {
  return { id, title, body, userId: 10, views: 100, reactions: { likes: 1, dislikes: 0 } }
}

function makeUser(id: number) {
  return { id, username: 'user', firstName: 'First', lastName: 'Last' }
}

const EDITED_POST_IDS_KEY = 'post_details_edited_ids'

beforeEach(() => {
  vi.clearAllMocks()
  mockedUseLoginUserStore.mockReturnValue({ user: { id: 1 } } as unknown as ReturnType<typeof useLoginUserStore>)
  for (const k of Object.keys(mockSessionStorage)) delete mockSessionStorage[k]
  Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true })
  setActivePinia(createPinia())
})

describe('postDetailsStore', () => {
  describe('initial state', () => {
    it('has correct defaults', () => {
      const store = usePostDetailsStore()

      expect(store.modalPostLoading).toBe(false)
      expect(store.modalRequestedPostId).toBeNull()
      expect(store.postDetailsCache).toEqual([])
      expect(store.originalTitle).toBe('')
      expect(store.originalBody).toBe('')
      expect(store.originalTags).toEqual([])
      expect(store.modalPostPosition).toBe(0)
      expect(store.editedPostIds).toEqual([])
      expect(store.viewedPostIds).toEqual([])
      expect(store.userReactions).toEqual({})
      expect(store.likedCommentIds).toEqual([])
      expect(store.modalNewPostDraft).toBeNull()
    })
  })

  describe('editedPostIds from sessionStorage (getEditedPostIdsFromStorage)', () => {
    it('initializes editedPostIds to empty array when key is missing', () => {
      const store = usePostDetailsStore()
      expect(store.editedPostIds).toEqual([])
    })

    it('initializes editedPostIds from valid JSON array of numbers', () => {
      mockSessionStorage[EDITED_POST_IDS_KEY] = '[1, 5, 10]'
      setActivePinia(createPinia())
      const store = usePostDetailsStore()
      expect(store.editedPostIds).toEqual([1, 5, 10])
    })

    it('filters out non-number elements from stored array', () => {
      mockSessionStorage[EDITED_POST_IDS_KEY] = '[1, "two", 3, null, 7, true]'
      setActivePinia(createPinia())
      const store = usePostDetailsStore()
      expect(store.editedPostIds).toEqual([1, 3, 7])
    })

    it('initializes to empty array when stored value is not an array', () => {
      mockSessionStorage[EDITED_POST_IDS_KEY] = '{"ids": [1,2]}'
      setActivePinia(createPinia())
      const store = usePostDetailsStore()
      expect(store.editedPostIds).toEqual([])
    })

    it('initializes to empty array when stored value is invalid JSON', () => {
      mockSessionStorage[EDITED_POST_IDS_KEY] = 'not json'
      setActivePinia(createPinia())
      const store = usePostDetailsStore()
      expect(store.editedPostIds).toEqual([])
    })

    it('initializes to empty array when getItem throws', () => {
      const originalGetItem = sessionStorageMock.getItem
      sessionStorageMock.getItem = vi.fn(() => {
        throw new Error('Storage unavailable')
      })
      setActivePinia(createPinia())
      const store = usePostDetailsStore()
      expect(store.editedPostIds).toEqual([])
      sessionStorageMock.getItem = originalGetItem
    })
  })

  describe('getters', () => {
    it('cachedEntry returns undefined when no post is requested', () => {
      const store = usePostDetailsStore()
      expect(store.cachedEntry).toBeUndefined()
    })

    it('cachedEntry returns matching cache entry', () => {
      const store = usePostDetailsStore()
      const post = makePost(5)
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.modalRequestedPostId = 5

      expect(store.cachedEntry?.post.id).toBe(5)
    })

    it('modalPost returns post from cached entry', () => {
      const store = usePostDetailsStore()
      const post = makePost(3, 'Hello')
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.modalRequestedPostId = 3

      expect(store.modalPost?.title).toBe('Hello')
    })

    it('modalPost returns null when nothing is cached', () => {
      const store = usePostDetailsStore()
      expect(store.modalPost).toBeNull()
    })

    it('modalUser returns user from cached entry', () => {
      const store = usePostDetailsStore()
      const user = makeUser(10)
      store.postDetailsCache = [{ post: makePost(1), user, comments: [] }]
      store.modalRequestedPostId = 1

      expect(store.modalUser?.id).toBe(10)
    })

    it('modalComments returns comments from cached entry', () => {
      const store = usePostDetailsStore()
      const comments = [
        { id: 1, body: 'Comment', postId: 1, likes: 0, user: { id: 1, username: 'u', fullName: 'U' } },
      ]
      store.postDetailsCache = [{ post: makePost(1), user: null, comments }]
      store.modalRequestedPostId = 1

      expect(store.modalComments).toHaveLength(1)
    })

    it('modalComments returns empty array when cached entry has no comments', () => {
      const store = usePostDetailsStore()
      store.postDetailsCache = [
        { post: makePost(1), user: null, comments: undefined } as unknown as import('@/stores/postDetailsStore').CachedPostDetails,
      ]
      store.modalRequestedPostId = 1

      expect(store.modalComments).toEqual([])
    })

    it('hasUnsavedChanges is false when nothing changed', () => {
      const store = usePostDetailsStore()
      const post = makePost(1, 'Title', 'Body')
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.modalRequestedPostId = 1
      store.originalTitle = 'Title'
      store.originalBody = 'Body'

      expect(store.hasUnsavedChanges).toBe(false)
    })

    it('hasUnsavedChanges is true when title differs', () => {
      const store = usePostDetailsStore()
      const post = makePost(1, 'Changed', 'Body')
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.modalRequestedPostId = 1
      store.originalTitle = 'Original'
      store.originalBody = 'Body'

      expect(store.hasUnsavedChanges).toBe(true)
    })

    it('hasUnsavedChanges is false when no modal post', () => {
      const store = usePostDetailsStore()
      expect(store.hasUnsavedChanges).toBe(false)
    })

    it('hasUnsavedChanges is true when only body differs', () => {
      const store = usePostDetailsStore()
      const post = makePost(1, 'Title', 'Changed body')
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.modalRequestedPostId = 1
      store.originalTitle = 'Title'
      store.originalBody = 'Original body'

      expect(store.hasUnsavedChanges).toBe(true)
    })

    it('modalPostWasEdited returns false when no post requested', () => {
      const store = usePostDetailsStore()
      expect(store.modalPostWasEdited).toBe(false)
    })

    it('modalPostWasEdited returns false when postId not in editedPostIds', () => {
      const store = usePostDetailsStore()
      store.modalRequestedPostId = 5
      store.editedPostIds = [1, 2, 3]
      expect(store.modalPostWasEdited).toBe(false)
    })

    it('modalPostWasEdited returns true when postId is in editedPostIds', () => {
      const store = usePostDetailsStore()
      store.modalRequestedPostId = 2
      store.editedPostIds = [1, 2, 3]
      expect(store.modalPostWasEdited).toBe(true)
    })
  })

  describe('snapshotOriginal', () => {
    it('saves current post title and body', () => {
      const store = usePostDetailsStore()
      store.postDetailsCache = [{ post: makePost(1, 'T', 'B'), user: null, comments: [] }]
      store.modalRequestedPostId = 1

      store.snapshotOriginal()

      expect(store.originalTitle).toBe('T')
      expect(store.originalBody).toBe('B')
    })

    it('uses empty strings when no modal post', () => {
      const store = usePostDetailsStore()

      store.snapshotOriginal()

      expect(store.originalTitle).toBe('')
      expect(store.originalBody).toBe('')
    })
  })

  describe('revertEdits', () => {
    it('reverts post to original values', () => {
      const store = usePostDetailsStore()
      const post = makePost(1, 'Modified', 'Modified body')
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.modalRequestedPostId = 1
      store.originalTitle = 'Original'
      store.originalBody = 'Original body'

      store.revertEdits()

      expect(store.modalPost!.title).toBe('Original')
      expect(store.modalPost!.body).toBe('Original body')
    })

    it('does nothing when no modal post', () => {
      const store = usePostDetailsStore()
      store.originalTitle = 'X'
      store.originalBody = 'Y'

      store.revertEdits()

      expect(store.originalTitle).toBe('X')
      expect(store.originalBody).toBe('Y')
    })
  })

  describe('loadPostForModal', () => {
    it('loads post by id from API and caches it', async () => {
      const store = usePostDetailsStore()
      const post = makePost(5, 'Loaded')
      const user = makeUser(10)
      mockedGetPostById.mockResolvedValue(post)
      mockedGetUser.mockResolvedValue(user)
      mockedGetPostComments.mockResolvedValue({ comments: [] })

      await store.loadPostForModal(1, 5)

      expect(store.modalRequestedPostId).toBe(5)
      expect(store.postDetailsCache).toHaveLength(1)
      expect(store.postDetailsCache[0]!.post.title).toBe('Loaded')
      expect(store.modalPostLoading).toBe(false)
    })

    it('uses cache when post was already loaded by id', async () => {
      const store = usePostDetailsStore()
      const post = makePost(5, 'Cached')
      store.postDetailsCache = [{ post, user: null, comments: [] }]

      await store.loadPostForModal(1, 5)

      expect(mockedGetPostById).not.toHaveBeenCalled()
      expect(store.modalRequestedPostId).toBe(5)
    })

    it('loads post by position (navigation) when postId is not provided', async () => {
      const store = usePostDetailsStore()
      const post = makePost(7, 'By position')
      mockedGetPosts.mockResolvedValue({
        posts: [post],
        total: 10,
      })
      mockedGetUser.mockResolvedValue(makeUser(10))
      mockedGetPostComments.mockResolvedValue({ comments: [] })

      await store.loadPostForModal(4, undefined, { query: '', field: 'title' })

      expect(store.modalRequestedPostId).toBe(7)
      expect(store.modalPostPosition).toBe(4)
    })

    it('uses cache by position when available', async () => {
      const store = usePostDetailsStore()
      const post = makePost(7, 'Cached by position')
      store.postDetailsCache = [{ post, user: null, comments: [], position: 4 }]

      await store.loadPostForModal(4)

      expect(mockedGetPosts).not.toHaveBeenCalled()
      expect(store.modalRequestedPostId).toBe(7)
    })

    it('handles case when API returns no posts', async () => {
      const store = usePostDetailsStore()
      mockedGetPosts.mockResolvedValue({ posts: [], totalPages: 1 })

      await store.loadPostForModal(99)

      expect(store.modalPostLoading).toBe(false)
      expect(store.postDetailsCache).toHaveLength(0)
    })

    it('aborts previous request', async () => {
      const store = usePostDetailsStore()
      const signals: AbortSignal[] = []

      mockedGetPostById.mockImplementation(async (id, signal) => {
        signals.push(signal!)
        return makePost(id)
      })
      mockedGetUser.mockResolvedValue(makeUser(1))
      mockedGetPostComments.mockResolvedValue({ comments: [] })

      const p1 = store.loadPostForModal(1, 1)
      const p2 = store.loadPostForModal(2, 2)
      await Promise.all([p1, p2])

      expect(signals[0]!.aborted).toBe(true)
    })

    it('handles user fetch failure gracefully', async () => {
      const store = usePostDetailsStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockedGetPostById.mockResolvedValue(makePost(1))
      mockedGetUser.mockRejectedValue(new Error('User not found'))
      mockedGetPostComments.mockResolvedValue({ comments: [] })

      await store.loadPostForModal(1, 1)

      expect(store.postDetailsCache[0]!.user).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('handles comments fetch failure gracefully', async () => {
      const store = usePostDetailsStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockedGetPostById.mockResolvedValue(makePost(1))
      mockedGetUser.mockResolvedValue(makeUser(1))
      mockedGetPostComments.mockRejectedValue(new Error('Comments error'))

      await store.loadPostForModal(1, 1)

      expect(store.postDetailsCache[0]!.comments).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching comments:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('does not log AbortError for user/comments failures', async () => {
      const store = usePostDetailsStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockedGetPostById.mockResolvedValue(makePost(1))
      mockedGetUser.mockRejectedValue(new DOMException('Aborted', 'AbortError'))
      mockedGetPostComments.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

      await store.loadPostForModal(1, 1)

      const nonAbortErrors = consoleSpy.mock.calls.filter(
        (call) => !(call[1] instanceof DOMException && (call[1] as DOMException).name === 'AbortError'),
      )
      expect(nonAbortErrors).toHaveLength(0)
      consoleSpy.mockRestore()
    })

    it('rethrows when getPostById throws', async () => {
      const store = usePostDetailsStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockedGetPostById.mockRejectedValue(new Error('Network error'))

      await expect(store.loadPostForModal(1, 1)).rejects.toThrow('Network error')
      expect(store.modalPostLoading).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching post:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('returns early when modalRequestedPostId changed during load by id', async () => {
      const store = usePostDetailsStore()
      mockedGetPostById.mockImplementation(async (id) => {
        store.modalRequestedPostId = 999
        return makePost(id)
      })
      mockedGetUser.mockResolvedValue(makeUser(1))
      mockedGetPostComments.mockResolvedValue({ comments: [] })

      await store.loadPostForModal(1, 1)

      expect(store.postDetailsCache).toHaveLength(0)
    })

    it('does not call getUser when post.userId is 0', async () => {
      const store = usePostDetailsStore()
      const post = makePost(1)
      post.userId = 0
      mockedGetPostById.mockResolvedValue(post)
      mockedGetPostComments.mockResolvedValue({ comments: [] })

      await store.loadPostForModal(1, 1)

      expect(mockedGetUser).not.toHaveBeenCalled()
      expect(store.postDetailsCache[0]!.user).toBeNull()
    })

    it('uses empty array when getPostComments returns fulfilled without comments', async () => {
      const store = usePostDetailsStore()
      mockedGetPostById.mockResolvedValue(makePost(1))
      mockedGetUser.mockResolvedValue(makeUser(1))
      mockedGetPostComments.mockResolvedValue({} as unknown as import('@/api/postApi').PostCommentsResponseDto)

      await store.loadPostForModal(1, 1)

      expect(store.postDetailsCache[0]!.comments).toEqual([])
    })

    it('uses searchContext defaults when not provided (load by position)', async () => {
      const store = usePostDetailsStore()
      const post = makePost(7)
      mockedGetPosts.mockResolvedValue({
        posts: [post],
        totalPages: 1,
      })
      mockedGetUser.mockResolvedValue(makeUser(10))
      mockedGetPostComments.mockResolvedValue({ comments: [] })

      await store.loadPostForModal(2)

      expect(mockedGetPosts).toHaveBeenCalledTimes(1)
      const callArg = mockedGetPosts.mock.calls[0]![0]
      expect(callArg).toMatchObject({
        _limit: 1,
        _page: 2,
        query: '',
        field: 'title',
      })
    })
  })

  describe('clearModalPost', () => {
    it('resets modal state', () => {
      const store = usePostDetailsStore()
      store.modalRequestedPostId = 5
      store.modalPostLoading = true
      store.modalPostPosition = 3

      store.clearModalPost()

      expect(store.modalRequestedPostId).toBeNull()
      expect(store.modalPostLoading).toBe(false)
      expect(store.modalPostPosition).toBe(0)
    })

    it('aborts in-flight request when called during load', async () => {
      const store = usePostDetailsStore()
      mockedGetPostById.mockImplementation(() => new Promise(() => {}))
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

      store.loadPostForModal(1, 1)
      await Promise.resolve()
      store.clearModalPost()

      expect(abortSpy).toHaveBeenCalled()
      expect(store.modalRequestedPostId).toBeNull()
      abortSpy.mockRestore()
    })
  })

  describe('clearPostDetailsCache', () => {
    it('empties the cache', () => {
      const store = usePostDetailsStore()
      store.postDetailsCache = [{ post: makePost(1), user: null, comments: [] }]

      store.clearPostDetailsCache()

      expect(store.postDetailsCache).toEqual([])
    })
  })

  describe('saveChanges', () => {
    it('returns null when no modal post', async () => {
      const store = usePostDetailsStore()

      const result = await store.saveChanges(1)

      expect(result).toBeNull()
      expect(mockedPatchPost).not.toHaveBeenCalled()
    })

    it('sends PATCH and updates originals on success', async () => {
      const store = usePostDetailsStore()
      const post = makePost(1, 'New Title', 'New Body')
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.modalRequestedPostId = 1
      const updatedPost = makePost(1, 'New Title', 'New Body')
      mockedPatchPost.mockResolvedValue(updatedPost)

      const result = await store.saveChanges(1)

      expect(result).not.toBeNull()
      expect(store.originalTitle).toBe('New Title')
      expect(store.originalBody).toBe('New Body')
    })

    it('returns null and does not update originals when updateModalPost fails', async () => {
      const store = usePostDetailsStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const post = makePost(1, 'Title', 'Body')
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.modalRequestedPostId = 1
      store.originalTitle = 'Title'
      store.originalBody = 'Body'
      mockedPatchPost.mockRejectedValue(new Error('Patch failed'))

      await expect(store.saveChanges(1)).rejects.toThrow('Patch failed')
      expect(store.originalTitle).toBe('Title')
      expect(store.originalBody).toBe('Body')
      consoleSpy.mockRestore()
    })
  })

  describe('updateModalPost', () => {
    it('calls patchPost and updates cache entry', async () => {
      const store = usePostDetailsStore()
      const post = makePost(1, 'Old')
      store.postDetailsCache = [{ post, user: null, comments: [], position: 1 }]
      const updated = makePost(1, 'Updated')
      mockedPatchPost.mockResolvedValue(updated)

      const result = await store.updateModalPost(1, { title: 'Updated' })

      expect(result).toEqual(updated)
      expect(store.postDetailsCache[0]!.post.title).toBe('Updated')
    })

    it('adds postId to editedPostIds and saves to sessionStorage on success', async () => {
      const store = usePostDetailsStore()
      store.editedPostIds = []
      store.postDetailsCache = [{ post: makePost(7), user: null, comments: [] }]
      const updated = makePost(7, 'Edited')
      mockedPatchPost.mockResolvedValue(updated)

      await store.updateModalPost(7, { title: 'Edited' })

      expect(store.editedPostIds).toContain(7)
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'post_details_edited_ids',
        JSON.stringify([7]),
      )
    })

    it('rethrows on error', async () => {
      const store = usePostDetailsStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockedPatchPost.mockRejectedValue(new Error('Patch failed'))

      await expect(store.updateModalPost(1, { title: 'X' })).rejects.toThrow('Patch failed')
      expect(consoleSpy).toHaveBeenCalledWith('Error updating post:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('does not log AbortError', async () => {
      const store = usePostDetailsStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockedPatchPost.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

      try {
        await store.updateModalPost(1, { title: 'X' })
      } catch {
        // expected rejection
      }

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('returns updated post without modifying cache when postId not in cache', async () => {
      const store = usePostDetailsStore()
      store.postDetailsCache = [{ post: makePost(1), user: null, comments: [] }]
      const updated = makePost(99, 'Updated')
      mockedPatchPost.mockResolvedValue(updated)

      const result = await store.updateModalPost(99, { title: 'Updated' })

      expect(mockedPatchPost).toHaveBeenCalledWith(99, { title: 'Updated' })
      expect(result).toEqual(updated)
      expect(store.postDetailsCache).toHaveLength(1)
      expect(store.postDetailsCache[0]!.post.id).toBe(1)
    })
  })

  describe('isModalNewPost getter', () => {
    it('returns false by default', () => {
      const store = usePostDetailsStore()
      expect(store.isModalNewPost).toBe(false)
    })

    it('returns true when modalNewPostDraft is set', () => {
      const store = usePostDetailsStore()
      store.modalNewPostDraft = makePost(0, '', '')
      expect(store.isModalNewPost).toBe(true)
    })
  })

  describe('modalPostUserReaction getter', () => {
    it('returns null when no post requested', () => {
      const store = usePostDetailsStore()
      expect(store.modalPostUserReaction).toBeNull()
    })

    it('returns null when no reaction for post', () => {
      const store = usePostDetailsStore()
      store.modalRequestedPostId = 5
      expect(store.modalPostUserReaction).toBeNull()
    })

    it('returns reaction when set', () => {
      const store = usePostDetailsStore()
      store.modalRequestedPostId = 5
      store.userReactions = { '5': 'like' }
      expect(store.modalPostUserReaction).toBe('like')
    })
  })

  describe('isCommentLiked getter', () => {
    it('returns false for unknown comment', () => {
      const store = usePostDetailsStore()
      expect(store.isCommentLiked(99)).toBe(false)
    })

    it('returns true for liked comment', () => {
      const store = usePostDetailsStore()
      store.likedCommentIds = [1, 5, 10]
      expect(store.isCommentLiked(5)).toBe(true)
    })
  })

  describe('openModalForNewPost', () => {
    it('sets draft and resets modal state', () => {
      const store = usePostDetailsStore()
      store.modalRequestedPostId = 5
      store.modalPostPosition = 3

      store.openModalForNewPost()

      expect(store.modalNewPostDraft).not.toBeNull()
      expect(store.modalNewPostDraft!.id).toBe(0)
      expect(store.modalNewPostDraft!.title).toBe('')
      expect(store.modalNewPostDraft!.body).toBe('')
      expect(store.modalRequestedPostId).toBeNull()
      expect(store.modalPostPosition).toBe(0)
      expect(store.modalPostLoading).toBe(false)
    })
  })

  describe('createModalPost', () => {
    it('returns null when no draft', async () => {
      const store = usePostDetailsStore()
      const result = await store.createModalPost(1)
      expect(result).toBeNull()
    })

    it('creates post, clears draft, caches result', async () => {
      const store = usePostDetailsStore()
      store.modalNewPostDraft = makePost(0, 'Title', 'Body')
      const created = makePost(100, 'Title', 'Body')
      mockedCreatePost.mockResolvedValue(created)
      mockedGetUser.mockResolvedValue(makeUser(10))

      const result = await store.createModalPost(42)

      expect(result).toEqual(created)
      expect(store.modalNewPostDraft).toBeNull()
      expect(store.modalRequestedPostId).toBe(100)
      expect(store.postDetailsCache).toHaveLength(1)
      expect(store.postDetailsCache[0]!.post.id).toBe(100)
      expect(mockedCreatePost).toHaveBeenCalledWith(expect.objectContaining({ userId: 42 }))
    })
  })

  describe('removePostFromCache', () => {
    it('removes post from cache', () => {
      const store = usePostDetailsStore()
      store.postDetailsCache = [{ post: makePost(5), user: null, comments: [] }]

      store.removePostFromCache(5)

      expect(store.postDetailsCache).toHaveLength(0)
    })

    it('removes postId from editedPostIds', () => {
      const store = usePostDetailsStore()
      store.postDetailsCache = [{ post: makePost(5), user: null, comments: [] }]
      store.editedPostIds = [5, 10]

      store.removePostFromCache(5)

      expect(store.editedPostIds).toEqual([10])
    })

    it('does nothing when post not in cache', () => {
      const store = usePostDetailsStore()
      store.postDetailsCache = [{ post: makePost(1), user: null, comments: [] }]

      store.removePostFromCache(99)

      expect(store.postDetailsCache).toHaveLength(1)
    })
  })

  describe('loadReactionsForUser', () => {
    const REACTIONS_KEY = 'post_user_reactions'
    const LIKED_KEY = 'post_liked_comments'

    it('loads reactions and liked comments for user from storage', () => {
      mockSessionStorage[REACTIONS_KEY] = JSON.stringify({ '1': { '5': 'like', '10': 'dislike' } })
      mockSessionStorage[LIKED_KEY] = JSON.stringify({ '1': [1, 2, 3] })
      setActivePinia(createPinia())
      const store = usePostDetailsStore()

      store.loadReactionsForUser(1)

      expect(store.userReactions).toEqual({ '5': 'like', '10': 'dislike' })
      expect(store.likedCommentIds).toEqual([1, 2, 3])
    })

    it('loads empty state when userId is null', () => {
      const store = usePostDetailsStore()
      store.userReactions = { '1': 'like' }
      store.likedCommentIds = [1, 2]

      store.loadReactionsForUser(null)

      expect(store.userReactions).toEqual({})
      expect(store.likedCommentIds).toEqual([])
    })

    it('loads only the given user slice when storage has multiple users', () => {
      mockSessionStorage[REACTIONS_KEY] = JSON.stringify({
        '1': { '5': 'like' },
        '2': { '10': 'dislike' },
      })
      mockSessionStorage[LIKED_KEY] = JSON.stringify({ '1': [1, 2], '2': [3, 4] })
      setActivePinia(createPinia())
      const store = usePostDetailsStore()

      store.loadReactionsForUser(2)

      expect(store.userReactions).toEqual({ '10': 'dislike' })
      expect(store.likedCommentIds).toEqual([3, 4])
    })
  })

  describe('incrementViews', () => {
    it('calls patchPostViews and updates cache', async () => {
      const store = usePostDetailsStore()
      store.viewedPostIds = []
      const post = makePost(5)
      post.views = 10
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      mockedPatchPostViews.mockResolvedValue(undefined)

      await store.incrementViews(5)

      expect(mockedPatchPostViews).toHaveBeenCalledWith(5, 11)
      expect(store.postDetailsCache[0]!.post.views).toBe(11)
      expect(store.viewedPostIds).toContain(5)
    })

    it('skips if already viewed', async () => {
      const store = usePostDetailsStore()
      store.viewedPostIds = [5]

      await store.incrementViews(5)

      expect(mockedPatchPostViews).not.toHaveBeenCalled()
    })

    it('does not throw on API error', async () => {
      const store = usePostDetailsStore()
      store.viewedPostIds = []
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      store.postDetailsCache = [{ post: makePost(5), user: null, comments: [] }]
      mockedPatchPostViews.mockRejectedValue(new Error('fail'))

      await store.incrementViews(5)

      expect(store.viewedPostIds).not.toContain(5)
      consoleSpy.mockRestore()
    })
  })

  describe('toggleReaction', () => {
    it('adds like when no current reaction', async () => {
      const store = usePostDetailsStore()
      const post = makePost(5)
      post.reactions = { likes: 10, dislikes: 2 }
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      mockedPatchPostReactions.mockResolvedValue(undefined)

      await store.toggleReaction(5, 'like')

      expect(post.reactions.likes).toBe(11)
      expect(post.reactions.dislikes).toBe(2)
      expect(store.userReactions['5']).toBe('like')
    })

    it('removes like when already liked', async () => {
      const store = usePostDetailsStore()
      const post = makePost(5)
      post.reactions = { likes: 10, dislikes: 2 }
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.userReactions = { '5': 'like' }
      mockedPatchPostReactions.mockResolvedValue(undefined)

      await store.toggleReaction(5, 'like')

      expect(post.reactions.likes).toBe(9)
      expect(store.userReactions['5']).toBeUndefined()
    })

    it('switches from like to dislike', async () => {
      const store = usePostDetailsStore()
      const post = makePost(5)
      post.reactions = { likes: 10, dislikes: 2 }
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      store.userReactions = { '5': 'like' }
      mockedPatchPostReactions.mockResolvedValue(undefined)

      await store.toggleReaction(5, 'dislike')

      expect(post.reactions.likes).toBe(9)
      expect(post.reactions.dislikes).toBe(3)
      expect(store.userReactions['5']).toBe('dislike')
    })

    it('rolls back on API error', async () => {
      const store = usePostDetailsStore()
      store.userReactions = {}
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const post = makePost(5)
      post.reactions = { likes: 10, dislikes: 2 }
      store.postDetailsCache = [{ post, user: null, comments: [] }]
      mockedPatchPostReactions.mockRejectedValue(new Error('fail'))

      await store.toggleReaction(5, 'like')

      expect(post.reactions.likes).toBe(10)
      expect(post.reactions.dislikes).toBe(2)
      expect(store.userReactions['5']).toBeUndefined()
      consoleSpy.mockRestore()
    })

    it('does nothing when post not in cache', async () => {
      const store = usePostDetailsStore()

      await store.toggleReaction(99, 'like')

      expect(mockedPatchPostReactions).not.toHaveBeenCalled()
    })
  })

  describe('toggleCommentLike', () => {
    it('adds like to comment', async () => {
      const store = usePostDetailsStore()
      const comment = { id: 1, body: 'Test', postId: 5, likes: 3, user: { id: 1, username: 'u', fullName: 'U' } }
      store.postDetailsCache = [{ post: makePost(5), user: null, comments: [comment] }]
      store.modalRequestedPostId = 5
      mockedPatchCommentLikes.mockResolvedValue(undefined)

      await store.toggleCommentLike(1)

      expect(comment.likes).toBe(4)
      expect(store.likedCommentIds).toContain(1)
    })

    it('removes like from comment', async () => {
      const store = usePostDetailsStore()
      const comment = { id: 1, body: 'Test', postId: 5, likes: 3, user: { id: 1, username: 'u', fullName: 'U' } }
      store.postDetailsCache = [{ post: makePost(5), user: null, comments: [comment] }]
      store.modalRequestedPostId = 5
      store.likedCommentIds = [1]
      mockedPatchCommentLikes.mockResolvedValue(undefined)

      await store.toggleCommentLike(1)

      expect(comment.likes).toBe(2)
      expect(store.likedCommentIds).not.toContain(1)
    })

    it('rolls back on API error', async () => {
      const store = usePostDetailsStore()
      store.likedCommentIds = []
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const comment = { id: 1, body: 'Test', postId: 5, likes: 3, user: { id: 1, username: 'u', fullName: 'U' } }
      store.postDetailsCache = [{ post: makePost(5), user: null, comments: [comment] }]
      store.modalRequestedPostId = 5
      mockedPatchCommentLikes.mockRejectedValue(new Error('fail'))

      await store.toggleCommentLike(1)

      expect(comment.likes).toBe(3)
      expect(store.likedCommentIds).not.toContain(1)
      consoleSpy.mockRestore()
    })

    it('does nothing when no cached entry', async () => {
      const store = usePostDetailsStore()

      await store.toggleCommentLike(1)

      expect(mockedPatchCommentLikes).not.toHaveBeenCalled()
    })

    it('does nothing when comment not found', async () => {
      const store = usePostDetailsStore()
      store.postDetailsCache = [{ post: makePost(5), user: null, comments: [] }]
      store.modalRequestedPostId = 5

      await store.toggleCommentLike(99)

      expect(mockedPatchCommentLikes).not.toHaveBeenCalled()
    })
  })
})
