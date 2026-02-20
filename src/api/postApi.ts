import type { PostResponseDto } from '@/dto/post/postResponseDto'
import { searchByTitleLocal } from './postLocalTitleSearch'

const POSTS_BASE_URL = 'https://dummyjson.com/posts'

export type PostSearchField = 'title' | 'body' | 'userId'

export interface GetPostsParams {
  limit: number
  skip: number
  query?: string
  field?: PostSearchField
  signal?: AbortSignal
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<PostResponseDto> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Failed to fetch posts: ${response.status}`)
  return (await response.json()) as PostResponseDto
}

export async function getPosts(params: GetPostsParams): Promise<PostResponseDto> {
  const { limit, skip, query = '', field = 'title', signal } = params
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return fetchJson(`${POSTS_BASE_URL}?limit=${limit}&skip=${skip}`, signal)
  }

  switch (field) {
    case 'title':
      return searchByTitleLocal(normalizedQuery, skip, limit, signal)

    case 'body':
      return fetchJson(
        `${POSTS_BASE_URL}/search?q=${encodeURIComponent(normalizedQuery)}&limit=${limit}&skip=${skip}`,
        signal,
      )

    case 'userId':
      if (!/^\d+$/.test(normalizedQuery)) {
        return { posts: [], total: 0, skip: 0, limit } as PostResponseDto
      }
      return fetchJson(
        `${POSTS_BASE_URL}/user/${normalizedQuery}?limit=${limit}&skip=${skip}`,
        signal,
      )

    default:
      return fetchJson(`${POSTS_BASE_URL}?limit=${limit}&skip=${skip}`, signal)
  }
}
