import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'

const POSTS_BASE_URL = 'https://dummyjson.com/posts'
const POSTS_SELECT = 'id,title,body,userId,reactions,views'

interface RawPost {
  id?: unknown
  title?: unknown
  body?: unknown
  userId?: unknown
  views?: unknown
  reactions?: {
    likes?: unknown
    dislikes?: unknown
  }
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toPostDto(raw: unknown): PostDto {
  const post = (typeof raw === 'object' && raw !== null ? raw : {}) as RawPost

  return {
    id: toFiniteNumber(post.id, 0),
    title: typeof post.title === 'string' ? post.title : '',
    body: typeof post.body === 'string' ? post.body : '',
    userId: toFiniteNumber(post.userId, 0),
    views: toFiniteNumber(post.views, 0),
    reactions: {
      likes: toFiniteNumber(post.reactions?.likes, 0),
      dislikes: toFiniteNumber(post.reactions?.dislikes, 0),
    },
  }
}

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

let allPostsCache: PostDto[] | null = null

async function getAllPosts(signal?: AbortSignal): Promise<PostDto[]> {
  if (allPostsCache) return allPostsCache

  const url = `${POSTS_BASE_URL}?limit=0&select=${encodeURIComponent(POSTS_SELECT)}`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch all posts: ${response.status}`)
  }

  const data = (await response.json()) as PostResponseDto
  const rawPosts = Array.isArray(data.posts) ? (data.posts as unknown[]) : []
  allPostsCache = rawPosts.map(toPostDto)

  return allPostsCache
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