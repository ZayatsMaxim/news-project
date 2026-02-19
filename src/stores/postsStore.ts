import { defineStore } from 'pinia'
import { PostDto } from '@/dto/post/postDto'
import { PostReactionsDto } from '@/dto/post/postDto'
import { PostResponseDto } from '@/dto/post/postResponseDto'

export const usePostsStore = defineStore('posts', {
  state: () => ({
    posts: [] as PostDto[],
    total: 0,
    skip: 0,
    limit: 9,
    page: 1,
    query: '',
  }),
  actions: {
    mapPosts(data: PostResponseDto) {
      this.posts = (data.posts || []).map(
        (post: PostDto) =>
          new PostDto({
            id: post.id,
            title: post.title,
            body: post.body,
            tags: post.tags || [],
            reactions: new PostReactionsDto({
              likes: post.reactions?.likes || 0,
              dislikes: post.reactions?.dislikes || 0,
            }),
            views: post.views || 0,
            userId: post.userId,
          }),
      )
      this.total = data.total || 0
      this.skip = data.skip || 0
      console.log(this.posts)
      console.log(this.total)
    },
    async fetchPosts() {
      try {
        const normalizedQuery = this.query.trim()
        const isNumericQuery = /^\d+$/.test(normalizedQuery)

        let url = ''

        if (!normalizedQuery) {
          url = `https://dummyjson.com/posts?limit=${this.limit}&skip=${this.skip}`
        } else if (isNumericQuery) {
          url = `https://dummyjson.com/posts/user/${normalizedQuery}?limit=${this.limit}&skip=${this.skip}`
        } else {
          url = `https://dummyjson.com/posts/search?q=${encodeURIComponent(normalizedQuery)}&limit=${this.limit}&skip=${this.skip}`
        }

        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to fetch posts')

        const data = (await response.json()) as PostResponseDto
        this.mapPosts(data)
      } catch (error) {
        console.error('Error fetching posts:', error)
      }
    },
    async searchPosts(query: string) {
      this.query = query
      this.page = 1
      this.skip = 0
      await this.fetchPosts()
    },
    async ensurePostsLoaded() {
      if (this.posts?.length) return
      await this.fetchPosts()
    },
    async loadPage(page: number) {
      this.page = page
      this.skip = this.requiredSkipAmount
      await this.fetchPosts()
    },
  },
  getters: {
    pagesAmount: (state) => Math.ceil(state.total / state.limit),
    requiredSkipAmount: (state) => (state.page - 1) * state.limit,
  },
})
