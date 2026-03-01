import type { PostDto } from './postDto'

export interface PostResponseDto {
  posts: PostDto[]
  /** Общее число записей (из заголовка X-Total-Count). */
  total?: number
  /** Общее число страниц (из заголовка Link, rel="last", параметр _page). */
  totalPages?: number
}
