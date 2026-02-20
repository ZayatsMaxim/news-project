import type { PostDto } from './postDto'

export interface PostResponseDto {
  posts: PostDto[]
  total: number
  skip: number
  limit: number
}