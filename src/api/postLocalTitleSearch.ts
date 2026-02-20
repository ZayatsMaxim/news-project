import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'

const POSTS_BASE_URL = 'https://dummyjson.com/posts'

let allPostsCache: PostDto[] | null = null

function toPaginated(posts: PostDto[], skip: number, limit: number): PostResponseDto {
  const safeSkip = Math.max(0, skip)
  const safeLimit = Math.max(1, limit)

  return {
    posts: posts.slice(safeSkip, safeSkip + safeLimit),
    total: posts.length,
    skip: safeSkip,
    limit: safeLimit,
  } as PostResponseDto
}

async function getAllPosts(signal?: AbortSignal): Promise<PostDto[]> {
  if (allPostsCache) return allPostsCache

  const response = await fetch(`${POSTS_BASE_URL}?limit=0`, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch all posts: ${response.status}`)
  }

  const data = (await response.json()) as PostResponseDto
  allPostsCache = Array.isArray(data.posts) ? data.posts : []
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
