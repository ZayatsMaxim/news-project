import type { CommentUserDto } from './commentUserDto'

/** Комментарий к посту (элемент ответа GET /posts/:postId/comments) */
export interface CommentDto {
  id: number
  body: string
  postId: number
  likes: number
  user: CommentUserDto
}
