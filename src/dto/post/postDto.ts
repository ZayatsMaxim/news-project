export interface PostReactionsDto {
  likes: number
  dislikes: number

  // constructor(data: { likes: number; dislikes: number }) {
  //   this.likes = data.likes
  //   this.dislikes = data.dislikes
  // }
}

export interface PostDto {
  id: number
  title: string
  body: string
  tags: string[]
  reactions: PostReactionsDto
  views: number
  userId: number
}
