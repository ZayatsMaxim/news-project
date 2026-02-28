import { apiConfig } from '@/config/api'
import { apiClient } from './axiosHttpClient'
import type { CommentDto } from '@/dto/post/comment/commentDto'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'
import { mapPostToDto, mapPostsListToDto, type RawPostDto } from '@/api/mappers/postMapper'
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
  | { kind: 'remote'; url: string; params: Record<string, string | number> }
  | { kind: 'local'; query: string }
  | { kind: 'empty' }

function resolvePostListRoute(query: string, field: PostSearchField): PostListRoute {
  if (!query) {
    return { kind: 'remote', url: POSTS_BASE_URL, params: {} }
  }
  switch (field) {
    case 'title':
      return { kind: 'local', query }
    case 'body':
      return {
        kind: 'remote',
        url: `${POSTS_BASE_URL}/search`,
        params: { q: query },
      }
    case 'userId':
      return /^\d+$/.test(query)
        ? { kind: 'remote', url: `${POSTS_BASE_URL}/user/${query}`, params: {} }
        : { kind: 'empty' }
    default:
      return { kind: 'remote', url: POSTS_BASE_URL, params: {} }
  }
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
  params: Record<string, string | number>,
  signal: AbortSignal | undefined,
  fallbackLimit: number,
): Promise<PostResponseDto> {
  const response = await apiClient.get<RawPostListResponse>(url, { signal, params })
  const rawPosts = Array.isArray(response.data.posts) ? response.data.posts : []
  return {
    posts: mapPostsListToDto(rawPosts),
    total: toFiniteNumber(response.data.total, 0),
    skip: toFiniteNumber(response.data.skip, 0),
    limit: toFiniteNumber(response.data.limit, fallbackLimit),
  }
}

export async function getPosts(params: GetPostsParams): Promise<PostResponseDto> {
  const { limit, skip, query = '', field = 'title', signal, select } = params
  const effectiveSelect = select ?? POSTS_SELECT
  const route = resolvePostListRoute(query.trim(), field)

  switch (route.kind) {
    case 'local':
      return searchByTitleLocal(route.query, skip, limit, signal)
    case 'empty':
      return emptyResponse(limit)
    case 'remote': {
      const requestParams = { ...route.params, limit, skip, select: effectiveSelect }
      return fetchPostsJson(route.url, requestParams, signal, limit)
    }
  }
}

/** Получить пост по id (GET /posts/:postId) */
export async function getPostById(postId: number, signal?: AbortSignal): Promise<PostDto> {
  const response = await apiClient.get<RawPostDto>(`${POSTS_BASE_URL}/${postId}`, { signal })
  return mapPostToDto(response.data)
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
  const response = await apiClient.patch<RawPostDto>(
    `${POSTS_BASE_URL}/${postId}`,
    body as Record<string, unknown>,
    { signal },
  )
  return mapPostToDto(response.data)
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
  const response = await apiClient.get<PostCommentsResponseDto>(
    `${POSTS_BASE_URL}/${postId}/comments`,
    { signal },
  )
  return response.data
}
