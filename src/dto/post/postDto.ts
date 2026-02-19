export class PostReactionsDto {
  likes: number
  dislikes: number

  constructor(data: { likes: number; dislikes: number }) {
    this.likes = data.likes
    this.dislikes = data.dislikes
  }
}

export class PostDto {
  id: number
  title: string
  body: string
  tags: string[]
  reactions: PostReactionsDto
  views: number
  userId: number

  constructor(data: {
    id: number
    title: string
    body: string
    tags: string[]
    reactions: PostReactionsDto
    views: number
    userId: number
  }) {
    this.id = data.id
    this.title = data.title
    this.body = data.body
    this.tags = data.tags
    this.reactions = data.reactions
    this.views = data.views
    this.userId = data.userId
  }
}
