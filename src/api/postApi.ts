import { apiConfig } from '@/config/api'
import { apiClient } from './axiosHttpClient'
import type { CommentDto } from '@/dto/post/comment/commentDto'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'
import { mapPostToDto, mapPostsListToDto, type RawPostDto } from '@/api/mappers/postMapper'

const POSTS_BASE_URL = apiConfig.postsBaseUrl
const COMMENTS_BASE_URL = apiConfig.commentsBaseUrl

export type PostSearchField = 'title' | 'body' | 'userId'

export interface GetPostsParams {
  _limit: number
  _page: number
  query?: string
  field?: PostSearchField
  signal?: AbortSignal
  /** Поля ответа (например: id,title,userId,body,reactions). Для json-server не используется. */
  select?: string
}

type PostListRoute = { kind: 'remote'; params: Record<string, string | number> } | { kind: 'empty' }

function resolvePostListRoute(query: string, field: PostSearchField): PostListRoute {
  const q = query.trim()
  if (!q) {
    return { kind: 'remote', params: {} }
  }
  switch (field) {
    case 'title':
      return { kind: 'remote', params: { title_like: q } }
    case 'body':
      return { kind: 'remote', params: { body_like: q } }
    case 'userId':
      return /^\d+$/.test(q) ? { kind: 'remote', params: { userId: q } } : { kind: 'empty' }
    default:
      return { kind: 'remote', params: {} }
  }
}

function emptyResponse(): PostResponseDto {
  return { posts: [], totalPages: 1 }
}

/**
 * Извлекает общее число записей из заголовка X-Total-Count.
 */
function parseTotalFromHeader(xTotalCount: string | undefined): number | undefined {
  if (xTotalCount === undefined || xTotalCount === null) return undefined
  const s = String(xTotalCount).trim()
  if (!s) return undefined
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Извлекает номер последней страницы из заголовка Link (rel="last").
 * Формат: <url>; rel="last" — в url ищется query-параметр _page.
 */
function parseLastPageFromLinkHeader(linkHeader: string | undefined): number | undefined {
  if (!linkHeader || typeof linkHeader !== 'string') return undefined
  const segments = linkHeader.split(',').map((s) => s.trim())
  for (const segment of segments) {
    if (!/rel="last"/i.test(segment)) continue
    const urlMatch = segment.match(/<([^>]+)>/)
    const url = urlMatch?.[1]
    if (!url) continue
    const pageMatch = url.match(/[?&]_page=(\d+)/)
    const pageNum = pageMatch?.[1]
    if (pageNum === undefined) continue
    const page = parseInt(pageNum, 10)
    if (Number.isFinite(page)) return page
  }
  return undefined
}

/** json-server возвращает массив постов и заголовок Link с rel="last" для числа страниц. */
async function fetchPostsJson(
  params: Record<string, string | number>,
  signal: AbortSignal | undefined,
): Promise<PostResponseDto> {
  const response = await apiClient.get<unknown>(POSTS_BASE_URL, { signal, params })
  const data = response.data
  const rawPosts: unknown[] = Array.isArray(data)
    ? data
    : data &&
        typeof data === 'object' &&
        'posts' in data &&
        Array.isArray((data as { posts: unknown[] }).posts)
      ? (data as { posts: unknown[] }).posts
      : []
  const linkHeader = response.headers?.['link']
  const totalPages = parseLastPageFromLinkHeader(
    typeof linkHeader === 'string' ? linkHeader : undefined,
  )
  const xTotalCount = response.headers?.['x-total-count']
  const total = parseTotalFromHeader(typeof xTotalCount === 'string' ? xTotalCount : undefined)
  return {
    posts: mapPostsListToDto(rawPosts),
    ...(total !== undefined ? { total } : {}),
    ...(totalPages !== undefined ? { totalPages } : {}),
  }
}

export async function getPosts(params: GetPostsParams): Promise<PostResponseDto> {
  const { _limit, _page, query = '', field = 'title', signal } = params
  const route = resolvePostListRoute(query, field)

  if (route.kind === 'empty') {
    return emptyResponse()
  }

  const requestParams: Record<string, string | number> = {
    _page,
    _limit,
    ...route.params,
  }
  return fetchPostsJson(requestParams, signal)
}

/** Получить пост по id (GET /posts/:postId) */
export async function getPostById(postId: number, signal?: AbortSignal): Promise<PostDto> {
  const response = await apiClient.get<RawPostDto>(`${POSTS_BASE_URL}/${postId}`, { signal })
  return mapPostToDto(response.data)
}

/** Тело PATCH-запроса для обновления поста. */
export interface PatchPostBody {
  title?: string
  body?: string
  tags?: string[]
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

/** Ответ GET /comments?postId=... */
export interface PostCommentsResponseDto {
  comments: CommentDto[]
}

/** Получить комментарии к посту (GET /comments?postId=postId). */
export async function getPostComments(
  postId: number,
  signal?: AbortSignal,
): Promise<PostCommentsResponseDto> {
  const response = await apiClient.get<CommentDto[]>(COMMENTS_BASE_URL, {
    signal,
    params: { postId },
  })
  const data = response.data
  const comments = Array.isArray(data) ? data : []
  return { comments }
}

export async function deletePost(postId: number, signal?: AbortSignal): Promise<void> {
  await apiClient.delete(`${POSTS_BASE_URL}/${postId}`, { signal })
}

export async function createPost(post: PostDto, signal?: AbortSignal): Promise<PostDto> {
  const response = await apiClient.post<RawPostDto>(POSTS_BASE_URL, post, { signal })
  return mapPostToDto(response.data)
}

export async function patchPostViews(postId: number, views: number): Promise<void> {
  await apiClient.patch(`${POSTS_BASE_URL}/${postId}`, { views })
}

export async function patchPostReactions(
  postId: number,
  reactions: { likes: number; dislikes: number },
): Promise<void> {
  await apiClient.patch(`${POSTS_BASE_URL}/${postId}`, { reactions })
}

export async function patchCommentLikes(commentId: number, likes: number): Promise<void> {
  await apiClient.patch(`${COMMENTS_BASE_URL}/${commentId}`, { likes })
}
