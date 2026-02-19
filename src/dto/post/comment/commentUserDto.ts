export class CommentUserDto {
  id: number
  username: string
  fullName: string

  constructor(data: { id: number; username: string; fullName: string }) {
    this.id = data.id
    this.username = data.username
    this.fullName = data.fullName
  }
}
