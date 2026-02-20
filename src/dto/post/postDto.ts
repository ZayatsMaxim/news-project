export interface PostReactionsDto {
  likes: number
  dislikes: number
}

export interface PostDto {
  id: number
  title: string
  body: string
  userId: number
  views: number
  reactions: PostReactionsDto
  /** Присутствует при запросе одного поста (GET /posts/:id) */
  tags?: string[]
}
