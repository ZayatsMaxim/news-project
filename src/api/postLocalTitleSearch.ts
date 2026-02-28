import { mapPostsListToDto } from '@/api/mappers/postMapper'
import { apiConfig } from '@/config/api'
import { apiClient } from './axiosHttpClient'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'

/**
 * Локальный поиск по title: загружается полный список постов и фильтрация идёт на клиенте.
 *
 * Стратегия обновления кэша:
 * - TTL: кэш считается валидным в течение CACHE_TTL_MS; по истечении при следующем запросе данные запрашиваются заново.
 * - Инвалидация: вызов invalidateLocalPostsCache() сбрасывает кэш (например, по кнопке «Обновить» в UI).
 * - Явное обновление: store предоставляет действие refreshPosts(), которое инвалидирует кэш и перезапрашивает текущий вид.
 */

const POSTS_BASE_URL = apiConfig.postsBaseUrl
const POSTS_SELECT = apiConfig.postsSelect

/** Время жизни кэша полного списка постов (мс). По истечении следующий поиск выполнит новый запрос к API. */
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 минут

function toPaginated(posts: PostDto[], skip: number, limit: number): PostResponseDto {
  const safeSkip = Math.max(0, skip)
  const safeLimit = Math.max(1, limit)

  return {
    posts: posts.slice(safeSkip, safeSkip + safeLimit),
    total: posts.length,
    skip: safeSkip,
    limit: safeLimit,
  }
}

interface AllPostsCacheEntry {
  data: PostDto[]
  fetchedAt: number
}

let allPostsCache: AllPostsCacheEntry | null = null

function isCacheValid(entry: AllPostsCacheEntry, ttlMs: number): boolean {
  return Date.now() - entry.fetchedAt < ttlMs
}

/**
 * Сбрасывает кэш полного списка постов для локального поиска по title.
 * Следующий поиск по title выполнит новый запрос к API.
 * Вызывать при явном действии пользователя (кнопка «Обновить») или при событиях, требующих актуальных данных.
 */
export function invalidateLocalPostsCache(): void {
  allPostsCache = null
}

async function getAllPosts(signal?: AbortSignal): Promise<PostDto[]> {
  if (allPostsCache && isCacheValid(allPostsCache, CACHE_TTL_MS)) {
    return allPostsCache.data
  }

  const response = await apiClient.get<{ posts?: unknown[] }>(POSTS_BASE_URL, {
    signal,
    params: { limit: 0, select: POSTS_SELECT },
  })
  const rawPosts = Array.isArray(response.data.posts) ? response.data.posts : []
  const posts = mapPostsListToDto(rawPosts)
  allPostsCache = { data: posts, fetchedAt: Date.now() }

  return posts
}

export async function searchByTitleLocal(
  query: string,
  skip: number,
  limit: number,
  signal?: AbortSignal,
): Promise<PostResponseDto> {
  const allPosts = await getAllPosts(signal)
  const q = query.trim().toLowerCase()

  const filtered = allPosts.filter((p) => p.title.toLowerCase().includes(q))
  return toPaginated(filtered, skip, limit)
}
