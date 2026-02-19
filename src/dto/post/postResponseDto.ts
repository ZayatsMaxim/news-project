import { PostDto } from './postDto'

export class PostResponseDto {
  posts: PostDto[]
  total: number
  skip: number
  limit: number

  constructor(data: { posts: PostDto[]; total: number; skip: number; limit: number }) {
    this.posts = data.posts
    this.total = data.total
    this.skip = data.skip
    this.limit = data.limit
  }
}
