import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/axiosHttpClient', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/config/api', () => ({
  apiConfig: {
    postsBaseUrl: 'https://api.test/posts',
    commentsBaseUrl: 'https://api.test/comments',
    postsSelect: 'id,title,body,userId,reactions,views',
  },
}))

const { getPosts, getPostById, patchPost, getPostComments, deletePost, createPost, patchPostViews, patchPostReactions, patchCommentLikes } = await import('@/api/postApi')
const { apiClient } = await import('@/api/axiosHttpClient')

const mockedGet = vi.mocked(apiClient.get)
const mockedPatch = vi.mocked(apiClient.patch)
const mockedDelete = vi.mocked(apiClient.delete)
const mockedPost = vi.mocked(apiClient.post)

function makeRawPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Test',
    body: 'Body',
    userId: 10,
    views: 100,
    reactions: { likes: 5, dislikes: 2 },
    ...overrides,
  }
}

function axiosResponse<T>(data: T, headers: Record<string, string> = {}) {
  return { data, headers, status: 200, statusText: 'OK', config: {} }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getPosts', () => {
  it('calls GET with _limit and _page when query is empty', async () => {
    mockedGet.mockResolvedValue(axiosResponse([makeRawPost()]))

    await getPosts({ _limit: 10, _page: 1 })

    expect(mockedGet).toHaveBeenCalledWith('https://api.test/posts', {
      signal: undefined,
      params: { _page: 1, _limit: 10 },
    })
  })

  it('passes title_like when field is title and query is set', async () => {
    mockedGet.mockResolvedValue(axiosResponse([]))

    await getPosts({ _limit: 10, _page: 1, query: 'hello', field: 'title' })

    expect(mockedGet).toHaveBeenCalledWith('https://api.test/posts', {
      signal: undefined,
      params: { _page: 1, _limit: 10, title_like: 'hello' },
    })
  })

  it('passes body_like when field is body', async () => {
    mockedGet.mockResolvedValue(axiosResponse([]))

    await getPosts({ _limit: 10, _page: 1, query: 'test query', field: 'body' })

    expect(mockedGet).toHaveBeenCalledWith('https://api.test/posts', {
      signal: undefined,
      params: { _page: 1, _limit: 10, body_like: 'test query' },
    })
  })

  it('passes userId when field is userId and query is numeric', async () => {
    mockedGet.mockResolvedValue(axiosResponse([]))

    await getPosts({ _limit: 10, _page: 1, query: '42', field: 'userId' })

    expect(mockedGet).toHaveBeenCalledWith('https://api.test/posts', {
      signal: undefined,
      params: { _page: 1, _limit: 10, userId: '42' },
    })
  })

  it('returns empty response for field userId with non-numeric query', async () => {
    const result = await getPosts({
      _limit: 10,
      _page: 1,
      query: 'abc',
      field: 'userId',
    })

    expect(mockedGet).not.toHaveBeenCalled()
    expect(result).toEqual({ posts: [], totalPages: 1 })
  })

  it('trims query before building params', async () => {
    mockedGet.mockResolvedValue(axiosResponse([]))

    await getPosts({ _limit: 5, _page: 1, query: '  spaced  ', field: 'title' })

    expect(mockedGet).toHaveBeenCalledWith(
      'https://api.test/posts',
      expect.objectContaining({
        params: expect.objectContaining({ title_like: 'spaced' }),
      }),
    )
  })

  it('maps response array to PostDto and returns total from X-Total-Count', async () => {
    mockedGet.mockResolvedValue(
      axiosResponse([makeRawPost({ id: 1, title: 'A' }), makeRawPost({ id: 2, title: 'B' })], {
        'x-total-count': '100',
        link: '<https://api.test/posts?_page=10>; rel="last"',
      }),
    )

    const result = await getPosts({ _limit: 10, _page: 1 })

    expect(result.posts).toHaveLength(2)
    expect(result.posts[0]!.title).toBe('A')
    expect(result.posts[1]!.title).toBe('B')
    expect(result.total).toBe(100)
    expect(result.totalPages).toBe(10)
  })

  it('returns totalPages from Link header when present', async () => {
    mockedGet.mockResolvedValue(
      axiosResponse([], {
        link: '<https://api.test/posts?_page=5&_limit=9>; rel="last"',
      }),
    )

    const result = await getPosts({ _limit: 9, _page: 1 })

    expect(result.totalPages).toBe(5)
  })

  it('does not include total or totalPages when headers missing', async () => {
    mockedGet.mockResolvedValue(axiosResponse([makeRawPost()]))

    const result = await getPosts({ _limit: 10, _page: 1 })

    expect(result.posts).toHaveLength(1)
    expect(result.total).toBeUndefined()
    expect(result.totalPages).toBeUndefined()
  })

  it('ignores invalid X-Total-Count (non-numeric) and does not set total', async () => {
    mockedGet.mockResolvedValue(
      axiosResponse([makeRawPost()], { 'x-total-count': 'not-a-number' }),
    )

    const result = await getPosts({ _limit: 10, _page: 1 })

    expect(result.posts).toHaveLength(1)
    expect(result.total).toBeUndefined()
  })

  it('handles response with posts in object shape', async () => {
    mockedGet.mockResolvedValue(
      axiosResponse({ posts: [makeRawPost({ id: 7, title: 'From object' })] }),
    )

    const result = await getPosts({ _limit: 10, _page: 1 })

    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]!.id).toBe(7)
    expect(result.posts[0]!.title).toBe('From object')
  })

  it('passes signal to request', async () => {
    mockedGet.mockResolvedValue(axiosResponse([]))
    const controller = new AbortController()

    await getPosts({ _limit: 5, _page: 1, signal: controller.signal })

    expect(mockedGet).toHaveBeenCalledWith(
      'https://api.test/posts',
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})

describe('getPostById', () => {
  it('fetches post by id and maps to PostDto', async () => {
    const raw = makeRawPost({ id: 5, title: 'Single', tags: ['vue', 'ts'] })
    mockedGet.mockResolvedValue(axiosResponse(raw))

    const result = await getPostById(5)

    expect(mockedGet).toHaveBeenCalledWith('https://api.test/posts/5', { signal: undefined })
    expect(result.id).toBe(5)
    expect(result.title).toBe('Single')
    expect(result.tags).toEqual(['vue', 'ts'])
  })

  it('passes signal', async () => {
    mockedGet.mockResolvedValue(axiosResponse(makeRawPost()))
    const controller = new AbortController()

    await getPostById(1, controller.signal)

    expect(mockedGet).toHaveBeenCalledWith('https://api.test/posts/1', {
      signal: controller.signal,
    })
  })
})

describe('patchPost', () => {
  it('sends PATCH and returns mapped post', async () => {
    const raw = makeRawPost({ id: 3, title: 'Updated' })
    mockedPatch.mockResolvedValue(axiosResponse(raw))

    const result = await patchPost(3, { title: 'Updated' })

    expect(mockedPatch).toHaveBeenCalledWith(
      'https://api.test/posts/3',
      { title: 'Updated' },
      { signal: undefined },
    )
    expect(result.id).toBe(3)
    expect(result.title).toBe('Updated')
  })

  it('sends title and body', async () => {
    mockedPatch.mockResolvedValue(axiosResponse(makeRawPost()))

    await patchPost(1, { title: 'T', body: 'B' })

    expect(mockedPatch.mock.calls[0]![1]).toEqual({ title: 'T', body: 'B' })
  })

  it('passes signal', async () => {
    mockedPatch.mockResolvedValue(axiosResponse(makeRawPost()))
    const controller = new AbortController()

    await patchPost(1, { title: 'X' }, controller.signal)

    expect(mockedPatch.mock.calls[0]![2]).toEqual({ signal: controller.signal })
  })
})

describe('getPostComments', () => {
  it('fetches comments by postId', async () => {
    const comments = [
      {
        id: 1,
        body: 'Nice',
        postId: 5,
        likes: 3,
        user: { id: 1, username: 'u1', fullName: 'User 1' },
      },
    ]
    mockedGet.mockResolvedValue(axiosResponse(comments))

    const result = await getPostComments(5)

    expect(mockedGet).toHaveBeenCalledWith('https://api.test/comments', {
      signal: undefined,
      params: { postId: 5 },
    })
    expect(result.comments).toHaveLength(1)
    expect(result.comments[0]!.body).toBe('Nice')
  })

  it('passes signal', async () => {
    mockedGet.mockResolvedValue(axiosResponse([]))
    const controller = new AbortController()

    await getPostComments(1, controller.signal)

    expect(mockedGet).toHaveBeenCalledWith(
      'https://api.test/comments',
      expect.objectContaining({ signal: controller.signal, params: { postId: 1 } }),
    )
  })

  it('wraps non-array response in comments array', async () => {
    mockedGet.mockResolvedValue(axiosResponse({ wrong: true }))

    const result = await getPostComments(1)

    expect(result.comments).toEqual([])
  })
})

describe('deletePost', () => {
  it('calls DELETE on correct URL', async () => {
    mockedDelete.mockResolvedValue(axiosResponse({}))

    await deletePost(5)

    expect(mockedDelete).toHaveBeenCalledWith('https://api.test/posts/5', { signal: undefined })
  })

  it('passes signal', async () => {
    mockedDelete.mockResolvedValue(axiosResponse({}))
    const controller = new AbortController()

    await deletePost(1, controller.signal)

    expect(mockedDelete).toHaveBeenCalledWith('https://api.test/posts/1', { signal: controller.signal })
  })
})

describe('createPost', () => {
  it('sends POST and returns mapped post', async () => {
    const raw = makeRawPost({ id: 99, title: 'New Post' })
    mockedPost.mockResolvedValue(axiosResponse(raw))
    const input = { id: 0, title: 'New Post', body: 'Body', userId: 1, views: 0, reactions: { likes: 0, dislikes: 0 }, tags: [] }

    const result = await createPost(input as any)

    expect(mockedPost).toHaveBeenCalledWith('https://api.test/posts', input, { signal: undefined })
    expect(result.id).toBe(99)
    expect(result.title).toBe('New Post')
  })
})

describe('patchPostViews', () => {
  it('sends PATCH with views', async () => {
    mockedPatch.mockResolvedValue(axiosResponse({}))

    await patchPostViews(5, 101)

    expect(mockedPatch).toHaveBeenCalledWith('https://api.test/posts/5', { views: 101 })
  })
})

describe('patchPostReactions', () => {
  it('sends PATCH with reactions', async () => {
    mockedPatch.mockResolvedValue(axiosResponse({}))

    await patchPostReactions(5, { likes: 10, dislikes: 2 })

    expect(mockedPatch).toHaveBeenCalledWith('https://api.test/posts/5', { reactions: { likes: 10, dislikes: 2 } })
  })
})

describe('patchCommentLikes', () => {
  it('sends PATCH with likes to comments endpoint', async () => {
    mockedPatch.mockResolvedValue(axiosResponse({}))

    await patchCommentLikes(7, 15)

    expect(mockedPatch).toHaveBeenCalledWith('https://api.test/comments/7', { likes: 15 })
  })
})
