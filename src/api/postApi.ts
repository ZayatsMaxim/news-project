import type { PostDto, PostReactionsDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'
import { searchByTitleLocal } from './postLocalTitleSearch'

const POSTS_BASE_URL = 'https://dummyjson.com/posts'
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

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`)
  }
  return (await response.json()) as T
}

async function fetchPostsJson(url: string, signal?: AbortSignal): Promise<PostResponseDto> {
  return fetchJson<PostResponseDto>(url, signal)
}

/** Ответ GET /posts/:id (с полем tags) */
interface RawPostById {
  id?: unknown
  title?: unknown
  body?: unknown
  userId?: unknown
  views?: unknown
  tags?: unknown
  reactions?: { likes?: unknown; dislikes?: unknown }
}

function toNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function toReactions(raw: RawPostById['reactions']): PostReactionsDto {
  return {
    likes: toNum(raw?.likes, 0),
    dislikes: toNum(raw?.dislikes, 0),
  }
}

function normalizePostById(raw: RawPostById): PostDto {
  const tags = Array.isArray(raw.tags)
    ? (raw.tags.filter((t): t is string => typeof t === 'string') as string[])
    : undefined
  return {
    id: toNum(raw.id, 0),
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    userId: toNum(raw.userId, 0),
    views: toNum(raw.views, 0),
    reactions: toReactions(raw.reactions),
    ...(tags?.length ? { tags } : {}),
  }
}

export async function getPosts(params: GetPostsParams): Promise<PostResponseDto> {
  const { limit, skip, query = '', field = 'title', signal } = params
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return fetchPostsJson(withSelect(`${POSTS_BASE_URL}?limit=${limit}&skip=${skip}`), signal)
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
      )

    case 'userId':
      if (!/^\d+$/.test(normalizedQuery)) {
        return emptyResponse(limit)
      }
      return fetchPostsJson(
        withSelect(`${POSTS_BASE_URL}/user/${normalizedQuery}?limit=${limit}&skip=${skip}`),
        signal,
      )

    default:
      return fetchPostsJson(withSelect(`${POSTS_BASE_URL}?limit=${limit}&skip=${skip}`), signal)
  }
}

/** Получить пост по id (GET /posts/:postId) */
export async function getPostById(postId: number, signal?: AbortSignal): Promise<PostDto> {
  const raw = await fetchJson<RawPostById>(`${POSTS_BASE_URL}/${postId}`, signal)
  return normalizePostById(raw)
}

/** Ответ GET /posts/:postId/comments */
export interface PostCommentsResponseDto {
  comments: Array<{
    id: number
    body: string
    postId: number
    likes: number
    user: { id: number; username: string; fullName: string }
  }>
  total?: number
  skip?: number
  limit?: number
}

/** Получить комментарии к посту (GET /posts/:postId/comments) */
export async function getPostComments(
  postId: number,
  signal?: AbortSignal,
): Promise<PostCommentsResponseDto> {
  return fetchJson<PostCommentsResponseDto>(`${POSTS_BASE_URL}/${postId}/comments`, signal)
}
