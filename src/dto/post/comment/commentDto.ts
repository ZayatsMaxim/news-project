import { CommentUserDto } from './commentUserDto'

export class CommentDto {
  id: number
  body: string
  postId: number
  likes: number
  user: CommentUserDto

  constructor(data: {
    id: number
    body: string
    postId: number
    likes: number
    user: CommentUserDto
  }) {
    this.id = data.id
    this.body = data.body
    this.postId = data.postId
    this.likes = data.likes
    this.user = data.user
  }
}
