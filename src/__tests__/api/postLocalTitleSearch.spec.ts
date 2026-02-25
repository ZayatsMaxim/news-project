import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchByTitleLocal, invalidateLocalPostsCache } from '@/api/postLocalTitleSearch'
import type { PostDto } from '@/dto/post/postDto'

/** Expected contract for all-posts fetch URL. */
const POSTS_PATH = '/posts'
const DEFAULT_SELECT = 'id,title,body,userId,reactions,views'

vi.mock('@/api/httpClient', () => ({
  fetchJson: vi.fn(),
}))

vi.mock('@/api/mappers/postMapper', () => ({
  normalizePostList: vi.fn((raw: unknown[]) => raw),
}))

import { fetchJson } from '@/api/httpClient'
const mockedFetchJson = vi.mocked(fetchJson)

function makePost(id: number, title: string): PostDto {
  return {
    id,
    title,
    body: '',
    userId: 1,
    views: 0,
    reactions: { likes: 0, dislikes: 0 },
  }
}

const allPosts = [
  makePost(1, 'Vue 3 Guide'),
  makePost(2, 'React Tutorial'),
  makePost(3, 'Vue Composition API'),
  makePost(4, 'TypeScript Handbook'),
  makePost(5, 'Advanced Vue Patterns'),
]

beforeEach(() => {
  vi.clearAllMocks()
  invalidateLocalPostsCache()
})

describe('searchByTitleLocal', () => {
  it('fetches all posts and filters by title query', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    const result = await searchByTitleLocal('vue', 0, 10)

    expect(result.posts).toHaveLength(3)
    expect(result.total).toBe(3)
    expect(result.posts.map((p) => p.id)).toEqual([1, 3, 5])
  })

  it('search is case-insensitive', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    const lowerCaseResult = await searchByTitleLocal('VUE', 0, 10)
    const upperCaseResult = await searchByTitleLocal('vue', 0, 10)
    expect(lowerCaseResult.total).toBe(3)
    expect(upperCaseResult.total).toBe(3)
    expect(lowerCaseResult.posts.map((p) => p.id)).toEqual([1, 3, 5])
    expect(upperCaseResult.posts.map((p) => p.id)).toEqual([1, 3, 5])
  })

  it('trims the query', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    const result = await searchByTitleLocal('  react  ', 0, 10)

    expect(result.total).toBe(1)
    expect(result.posts[0]!.id).toBe(2)
  })

  it('paginates results with skip and limit', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    const firstPageResult = await searchByTitleLocal('vue', 1, 1)
    const secondPageResult = await searchByTitleLocal('vue', 2, 1)

    expect(firstPageResult.posts).toHaveLength(1)
    expect(firstPageResult.posts[0]!.id).toBe(3)
    expect(firstPageResult.total).toBe(3)
    expect(firstPageResult.skip).toBe(1)
    expect(firstPageResult.limit).toBe(1)

    expect(secondPageResult.posts).toHaveLength(1)
    expect(secondPageResult.posts[0]!.id).toBe(5)
    expect(secondPageResult.total).toBe(3)
    expect(secondPageResult.skip).toBe(2)
    expect(secondPageResult.limit).toBe(1)
  })

  it('returns empty when no matches', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    const result = await searchByTitleLocal('angular', 0, 10)

    expect(result.posts).toEqual([])
    expect(result.total).toBe(0)
  })

  it('clamps skip to 0 when negative', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    const result = await searchByTitleLocal('vue', -5, 10)

    expect(result.posts).toHaveLength(3)
    expect(result.skip).toBe(0)
  })

  it('clamps limit to 1 when 0 or negative', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    const result = await searchByTitleLocal('vue', 0, 0)

    expect(result.posts).toHaveLength(1)
    expect(result.limit).toBe(1)
  })

  it('caches the fetched posts and does not re-fetch on second call', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    await searchByTitleLocal('vue', 0, 10)
    await searchByTitleLocal('react', 0, 10)

    expect(mockedFetchJson).toHaveBeenCalledTimes(1)
  })

  it('re-fetches after cache invalidation', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    await searchByTitleLocal('vue', 0, 10)
    invalidateLocalPostsCache()
    await searchByTitleLocal('vue', 0, 10)

    expect(mockedFetchJson).toHaveBeenCalledTimes(2)
  })

  it('builds the correct URL for the all-posts fetch', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [] })

    await searchByTitleLocal('x', 0, 10)

    expect(mockedFetchJson).toHaveBeenCalledWith(
      expect.stringContaining(POSTS_PATH),
      expect.objectContaining({
        params: { limit: 0, select: DEFAULT_SELECT },
      }),
    )
  })

  it('handles missing posts array in API response', async () => {
    mockedFetchJson.mockResolvedValue({})

    const result = await searchByTitleLocal('vue', 0, 10)

    expect(result.posts).toEqual([])
    expect(result.total).toBe(0)
  })

  it('passes signal to fetchJson', async () => {
    mockedFetchJson.mockResolvedValue({ posts: [] })
    const controller = new AbortController()

    await searchByTitleLocal('x', 0, 10, controller.signal)

    expect(mockedFetchJson.mock.calls[0]![1]).toEqual({
      signal: controller.signal,
      params: { limit: 0, select: DEFAULT_SELECT },
    })
  })
})

describe('invalidateLocalPostsCache', () => {
  it('causes next search to re-fetch data', async () => {
    mockedFetchJson.mockResolvedValue({ posts: allPosts })

    await searchByTitleLocal('vue', 0, 10)
    expect(mockedFetchJson).toHaveBeenCalledTimes(1)

    invalidateLocalPostsCache()

    await searchByTitleLocal('vue', 0, 10)
    expect(mockedFetchJson).toHaveBeenCalledTimes(2)
  })
})
