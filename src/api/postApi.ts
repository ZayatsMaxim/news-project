import { fetchJson, fetchPatchJson } from '@/api/httpClient'
import { apiConfig } from '@/config/api'
import type { CommentDto } from '@/dto/post/comment/commentDto'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'
import { normalizePost, normalizePostList, type RawPostDto } from '@/api/mappers/postMapper'
import { toFiniteNumber } from '@/utils/number'
import { searchByTitleLocal } from './postLocalTitleSearch'

const POSTS_BASE_URL = apiConfig.postsBaseUrl
const POSTS_SELECT = apiConfig.postsSelect

export type PostSearchField = 'title' | 'body' | 'userId'

export interface GetPostsParams {
  limit: number
  skip: number
  query?: string
  field?: PostSearchField
  signal?: AbortSignal
  /** Поля ответа (например: id,title,userId,body,reactions). Без указания используется postsSelect. */
  select?: string
}

type PostListRoute =
  | { kind: 'remote'; url: string }
  | { kind: 'local'; query: string }
  | { kind: 'empty' }

function resolvePostListRoute(
  query: string,
  field: PostSearchField,
  limit: number,
  skip: number,
): PostListRoute {
  if (!query) {
    return { kind: 'remote', url: `${POSTS_BASE_URL}?limit=${limit}&skip=${skip}` }
  }
  switch (field) {
    case 'title':
      return { kind: 'local', query }
    case 'body':
      return {
        kind: 'remote',
        url: `${POSTS_BASE_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}&skip=${skip}`,
      }
    case 'userId':
      return /^\d+$/.test(query)
        ? { kind: 'remote', url: `${POSTS_BASE_URL}/user/${query}?limit=${limit}&skip=${skip}` }
        : { kind: 'empty' }
    default:
      return { kind: 'remote', url: `${POSTS_BASE_URL}?limit=${limit}&skip=${skip}` }
  }
}

function withSelectParam(url: string, select: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}select=${encodeURIComponent(select)}`
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
  const { limit, skip, query = '', field = 'title', signal, select } = params
  const effectiveSelect = select ?? POSTS_SELECT
  const route = resolvePostListRoute(query.trim(), field, limit, skip)

  switch (route.kind) {
    case 'local':
      return searchByTitleLocal(route.query, skip, limit, signal)
    case 'empty':
      return emptyResponse(limit)
    case 'remote':
      return fetchPostsJson(withSelectParam(route.url, effectiveSelect), signal, limit)
  }
}

/** Возвращает только id постов на странице; для навигации в модалке без полной загрузки. */
export async function getPostIds(params: Omit<GetPostsParams, 'signal'>): Promise<number[]> {
  const data = await getPosts(params)
  return data.posts.map((p) => p.id)
}

/** Получить пост по id (GET /posts/:postId) */
export async function getPostById(postId: number, signal?: AbortSignal): Promise<PostDto> {
  const raw = await fetchJson<RawPostDto>(`${POSTS_BASE_URL}/${postId}`, { signal })
  return normalizePost(raw)
}

/** Тело PATCH-запроса для обновления поста (dummyjson принимает частичные поля). */
export interface PatchPostBody {
  title?: string
  body?: string
}

/** Обновить пост (PATCH /posts/:postId). Возвращает обновлённый пост с сервера. */
export async function patchPost(
  postId: number,
  body: PatchPostBody,
  signal?: AbortSignal,
): Promise<PostDto> {
  const raw = await fetchPatchJson<RawPostDto>(
    `${POSTS_BASE_URL}/${postId}`,
    body as Record<string, unknown>,
    { signal },
  )
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
