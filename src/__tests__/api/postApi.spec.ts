import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPosts, getPostById, patchPost, getPostComments, getPostIds } from '@/api/postApi'

/** Expected contract: path and default select so tests fail if production config drifts. */
const POSTS_PATH = '/posts'
const DEFAULT_SELECT = 'id,title,body,userId,reactions,views'

vi.mock('@/api/httpClient', () => ({
  fetchJson: vi.fn(),
  fetchPatchJson: vi.fn(),
}))

vi.mock('@/api/postLocalTitleSearch', () => ({
  searchByTitleLocal: vi.fn(),
}))

import { fetchJson, fetchPatchJson } from '@/api/httpClient'
import { searchByTitleLocal } from '@/api/postLocalTitleSearch'

const mockedFetchJson = vi.mocked(fetchJson)
const mockedFetchPatchJson = vi.mocked(fetchPatchJson)
const mockedSearchLocal = vi.mocked(searchByTitleLocal)

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

beforeEach(() => {
  vi.clearAllMocks()
})

// --- getPosts ---

describe('getPosts', () => {
  it('fetches from base URL when query is empty', async () => {
    mockedFetchJson.mockResolvedValue({
      posts: [makeRawPost()],
      total: 1,
      skip: 0,
      limit: 10,
    })

    const result = await getPosts({ limit: 10, skip: 0 })

    expect(mockedFetchJson).toHaveBeenCalledOnce()
    const url = mockedFetchJson.mock.calls[0]![0] as string
    expect(url).toContain(POSTS_PATH)
    expect(url).toContain('limit=10&skip=0')
    expect(url).toContain(`select=${encodeURIComponent(DEFAULT_SELECT)}`)
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]!.id).toBe(1)
    expect(result.total).toBe(1)
  })

  it('uses custom select param when provided', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [], total: 0, skip: 0, limit: 5 })

    await getPosts({ limit: 5, skip: 0, select: 'id,title' })

    const url = mockedFetchJson.mock.calls[0]![0] as string
    expect(url).toContain(POSTS_PATH)
    expect(url).toContain(`select=${encodeURIComponent('id,title')}`)
  })

  it('delegates to searchByTitleLocal when field=title and query is set', async () => {
    const localResult = { posts: [], total: 0, skip: 0, limit: 10 }
    mockedSearchLocal.mockResolvedValue(localResult)

    const result = await getPosts({ limit: 10, skip: 0, query: 'hello', field: 'title' })

    expect(mockedSearchLocal).toHaveBeenCalledWith('hello', 0, 10, undefined)
    expect(mockedFetchJson).not.toHaveBeenCalled()
    expect(result).toBe(localResult)
  })

  it('fetches from /search endpoint when field=body', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [], total: 0, skip: 0, limit: 10 })

    await getPosts({ limit: 10, skip: 0, query: 'test query', field: 'body' })

    const url = mockedFetchJson.mock.calls[0]![0] as string
    expect(url).toContain(POSTS_PATH)
    expect(url).toContain('/search?q=')
    expect(url).toContain(encodeURIComponent('test query'))
    expect(url).toContain('limit=10')
    expect(url).toContain('skip=0')
  })

  it('fetches from /user/:id endpoint when field=userId with numeric query', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [], total: 0, skip: 0, limit: 10 })

    await getPosts({ limit: 10, skip: 0, query: '42', field: 'userId' })

    const url = mockedFetchJson.mock.calls[0]![0] as string
    expect(url).toContain(POSTS_PATH)
    expect(url).toContain('/user/42')
  })

  it('returns empty response for field=userId with non-numeric query', async () => {
    const result = await getPosts({ limit: 10, skip: 0, query: 'abc', field: 'userId' })

    expect(mockedFetchJson).not.toHaveBeenCalled()
    expect(mockedSearchLocal).not.toHaveBeenCalled()
    expect(result).toEqual({ posts: [], total: 0, skip: 0, limit: 10 })
  })

  it('trims query before routing', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [], total: 0, skip: 0, limit: 5 })

    await getPosts({ limit: 5, skip: 0, query: '  ', field: 'body' })

    const url = mockedFetchJson.mock.calls[0]![0] as string
    expect(url).toContain(POSTS_PATH)
    expect(url).toContain('limit=5&skip=0')
  })

  it('falls back to base URL for unknown search field (default branch)', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [], total: 0, skip: 0, limit: 5 })

    await getPosts({
      limit: 5,
      skip: 0,
      query: 'something',
      field: 'unknown' as import('@/api/postApi').PostSearchField,
    })

    const url = mockedFetchJson.mock.calls[0]![0] as string
    expect(url).toContain(POSTS_PATH)
    expect(url).toContain('limit=5&skip=0')
    expect(mockedSearchLocal).not.toHaveBeenCalled()
  })

  it('normalizes posts from raw response', async () => {
    mockedFetchJson.mockResolvedValue({
      posts: [
        makeRawPost({ id: 1, title: 'A' }),
        makeRawPost({ id: 2, title: 'B' }),
      ],
      total: 2,
      skip: 0,
      limit: 10,
    })

    const result = await getPosts({ limit: 10, skip: 0 })

    expect(result.posts).toHaveLength(2)
    expect(result.posts[0]!.title).toBe('A')
    expect(result.posts[1]!.title).toBe('B')
  })

  it('handles missing posts array in response gracefully', async () => {
    mockedFetchJson.mockResolvedValue({ total: 0, skip: 0, limit: 10 })

    const result = await getPosts({ limit: 10, skip: 0 })

    expect(result.posts).toEqual([])
  })

  it('uses fallback for non-finite total/skip/limit', async () => {
    mockedFetchJson.mockResolvedValue({
      posts: [],
      total: 'bad',
      skip: null,
      limit: undefined,
    })

    const result = await getPosts({ limit: 7, skip: 0 })

    expect(result.total).toBe(0)
    expect(result.skip).toBe(0)
    expect(result.limit).toBe(7)
  })

  it('passes signal to fetchJson', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [], total: 0, skip: 0, limit: 5 })
    const controller = new AbortController()

    await getPosts({ limit: 5, skip: 0, signal: controller.signal })

    expect(mockedFetchJson.mock.calls[0]![1]).toEqual({ signal: controller.signal })
  })
})

// --- getPostIds ---

describe('getPostIds', () => {
  it('returns array of post ids', async () => {
    mockedFetchJson.mockResolvedValue({
      posts: [makeRawPost({ id: 10 }), makeRawPost({ id: 20 }), makeRawPost({ id: 30 })],
      total: 3,
      skip: 0,
      limit: 10,
    })

    const ids = await getPostIds({ limit: 10, skip: 0 })

    expect(ids).toEqual([10, 20, 30])
  })

  it('returns empty array when no posts', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [], total: 0, skip: 0, limit: 10 })

    const ids = await getPostIds({ limit: 10, skip: 0 })

    expect(ids).toEqual([])
  })
})

// --- getPostById ---

describe('getPostById', () => {
  it('fetches a single post by id and normalizes it', async () => {
    const raw = makeRawPost({ id: 5, title: 'Single', tags: ['vue', 'ts'] })
    mockedFetchJson.mockResolvedValue(raw)

    const result = await getPostById(5)

    expect(mockedFetchJson).toHaveBeenCalledWith(expect.stringContaining(`${POSTS_PATH}/5`), { signal: undefined })
    expect(result.id).toBe(5)
    expect(result.title).toBe('Single')
    expect(result.tags).toEqual(['vue', 'ts'])
  })

  it('passes signal to fetchJson', async () => {
    mockedFetchJson.mockResolvedValue(makeRawPost())
    const controller = new AbortController()

    await getPostById(1, controller.signal)

    expect(mockedFetchJson).toHaveBeenCalledWith(expect.stringContaining(`${POSTS_PATH}/1`), { signal: controller.signal })
  })
})

// --- patchPost ---

describe('patchPost', () => {
  it('sends PATCH request and returns normalized post', async () => {
    const raw = makeRawPost({ id: 3, title: 'Updated' })
    mockedFetchPatchJson.mockResolvedValue(raw)

    const result = await patchPost(3, { title: 'Updated' })

    expect(mockedFetchPatchJson).toHaveBeenCalledWith(
      expect.stringContaining(`${POSTS_PATH}/3`),
      { title: 'Updated' },
      { signal: undefined },
    )
    expect(result.id).toBe(3)
    expect(result.title).toBe('Updated')
  })

  it('sends both title and body', async () => {
    mockedFetchPatchJson.mockResolvedValue(makeRawPost())

    await patchPost(1, { title: 'T', body: 'B' })

    expect(mockedFetchPatchJson.mock.calls[0]![1]).toEqual({ title: 'T', body: 'B' })
  })

  it('passes signal to fetchPatchJson', async () => {
    mockedFetchPatchJson.mockResolvedValue(makeRawPost())
    const controller = new AbortController()

    await patchPost(1, { title: 'X' }, controller.signal)

    expect(mockedFetchPatchJson.mock.calls[0]![2]).toEqual({ signal: controller.signal })
  })
})

// --- getPostComments ---

describe('getPostComments', () => {
  it('fetches comments for a post', async () => {
    const response = {
      comments: [
        { id: 1, body: 'Nice', postId: 5, likes: 3, user: { id: 1, username: 'u1', fullName: 'User 1' } },
      ],
      total: 1,
      skip: 0,
      limit: 30,
    }
    mockedFetchJson.mockResolvedValue(response)

    const result = await getPostComments(5)

    expect(mockedFetchJson).toHaveBeenCalledWith(expect.stringContaining(`${POSTS_PATH}/5/comments`), { signal: undefined })
    expect(result.comments).toHaveLength(1)
    expect(result.comments[0]!.body).toBe('Nice')
  })

  it('passes signal to fetchJson', async () => {
    mockedFetchJson.mockResolvedValue({ comments: [] })
    const controller = new AbortController()

    await getPostComments(1, controller.signal)

    expect(mockedFetchJson).toHaveBeenCalledWith(expect.stringContaining(`${POSTS_PATH}/1/comments`), { signal: controller.signal })
  })
})
