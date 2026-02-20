import { fetchJson } from '@/api/httpClient'
import { apiConfig } from '@/config/api'
import type { CommentDto } from '@/dto/post/comment/commentDto'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'
import { normalizePost, normalizePostList, type RawPostDto } from '@/api/mappers/postMapper'
import { toFiniteNumber } from '@/utils/number'
import { searchByTitleLocal } from './postLocalTitleSearch'

const POSTS_BASE_URL = apiConfig.postsBaseUrl
const POSTS_SELECT = 'id,title,body,userId,reactions,views'

export type PostSearchField = 'title' | 'body' | 'userId'

export interface GetPostsParams {
  limit: number
  skip: number
  query?: string
  field?: PostSearchField
  signal?: AbortSignal
}

function withSelect(url: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}select=${encodeURIComponent(POSTS_SELECT)}`
}

function emptyResponse(limit: number): PostResponseDto {
  return { posts: [], total: 0, skip: 0, limit }
}

interface RawPostListResponse {
  posts?: unknown[]
  total?: unknown
  skip?: unknown
  limit?: unknown
}

async function fetchPostsJson(
  url: string,
  signal: AbortSignal | undefined,
  fallbackLimit: number,
): Promise<PostResponseDto> {
  const data = await fetchJson<RawPostListResponse>(url, { signal })
  const rawPosts = Array.isArray(data.posts) ? data.posts : []
  return {
    posts: normalizePostList(rawPosts),
    total: toFiniteNumber(data.total, 0),
    skip: toFiniteNumber(data.skip, 0),
    limit: toFiniteNumber(data.limit, fallbackLimit),
  }
}

export async function getPosts(params: GetPostsParams): Promise<PostResponseDto> {
  const { limit, skip, query = '', field = 'title', signal } = params
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return fetchPostsJson(
      withSelect(`${POSTS_BASE_URL}?limit=${limit}&skip=${skip}`),
      signal,
      limit,
    )
  }

  switch (field) {
    case 'title':
      return searchByTitleLocal(normalizedQuery, skip, limit, signal)

    case 'body':
      return fetchPostsJson(
        withSelect(
          `${POSTS_BASE_URL}/search?q=${encodeURIComponent(normalizedQuery)}&limit=${limit}&skip=${skip}`,
        ),
        signal,
        limit,
      )

    case 'userId':
      if (!/^\d+$/.test(normalizedQuery)) {
        return emptyResponse(limit)
      }
      return fetchPostsJson(
        withSelect(`${POSTS_BASE_URL}/user/${normalizedQuery}?limit=${limit}&skip=${skip}`),
        signal,
        limit,
      )

    default:
      return fetchPostsJson(
        withSelect(`${POSTS_BASE_URL}?limit=${limit}&skip=${skip}`),
        signal,
        limit,
      )
  }
}

/** Получить пост по id (GET /posts/:postId) */
export async function getPostById(postId: number, signal?: AbortSignal): Promise<PostDto> {
  const raw = await fetchJson<RawPostDto>(`${POSTS_BASE_URL}/${postId}`, { signal })
  return normalizePost(raw)
}

/** Ответ GET /posts/:postId/comments */
export interface PostCommentsResponseDto {
  comments: CommentDto[]
  total?: number
  skip?: number
  limit?: number
}

/** Получить комментарии к посту (GET /posts/:postId/comments) */
export async function getPostComments(
  postId: number,
  signal?: AbortSignal,
): Promise<PostCommentsResponseDto> {
  return fetchJson<PostCommentsResponseDto>(`${POSTS_BASE_URL}/${postId}/comments`, { signal })
}
