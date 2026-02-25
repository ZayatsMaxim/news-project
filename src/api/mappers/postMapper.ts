import type { PostDto, PostReactionsDto } from '@/dto/post/postDto'
import { toFiniteNumber } from '@/utils/number'

/** Сырой объект поста из API (поля могут быть любого типа). Для GET /posts/:id может быть tags. */
export interface RawPostDto {
  id?: unknown
  title?: unknown
  body?: unknown
  userId?: unknown
  views?: unknown
  tags?: unknown
  reactions?: { likes?: unknown; dislikes?: unknown }
}

function normalizeReactions(raw: RawPostDto['reactions']): PostReactionsDto {
  return {
    likes: toFiniteNumber(raw?.likes, 0),
    dislikes: toFiniteNumber(raw?.dislikes, 0),
  }
}

/**
 * Нормализует сырой объект поста из API в PostDto.
 * Поддерживает ответ для списка постов (без tags) и ответ для одного поста (GET /posts/:id с полем tags).
 */
export function normalizePost(raw: unknown): PostDto {
  const post = (typeof raw === 'object' && raw !== null ? raw : {}) as RawPostDto
  const tags = Array.isArray(post.tags)
    ? (post.tags.filter((t): t is string => typeof t === 'string') as string[])
    : undefined
  return {
    id: toFiniteNumber(post.id, 0),
    title: typeof post.title === 'string' ? post.title : '',
    body: typeof post.body === 'string' ? post.body : '',
    userId: toFiniteNumber(post.userId, 0),
    views: toFiniteNumber(post.views, 0),
    reactions: normalizeReactions(post.reactions),
    ...(tags?.length ? { tags } : {}),
  }
}

/**
 * Нормализует массив сырых постов в PostDto[].
 */
export function normalizePostList(rawPosts: unknown[]): PostDto[] {
  return rawPosts.map(normalizePost)
}
