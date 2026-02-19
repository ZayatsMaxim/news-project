import { defineStore } from 'pinia'
import { PostDto } from '@/dto/post/postDto'
import { PostReactionsDto } from '@/dto/post/postDto'

export const usePostsStore = defineStore('posts', {
  state: () => ({
    posts: [] as PostDto[],
    total: 0,
    skip: 0,
    limit: 9,
    page: 1,
  }),
  actions: {
    async fetchPosts() {
      try {
        const response = await fetch(
          `https://dummyjson.com/posts?limit=${this.limit}&skip=${this.skip}`,
        )
        if (!response.ok) throw new Error('Failed to fetch posts')
        const data = await response.json()

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
      } catch (error) {
        console.error('Error fetching posts:', error)
      }
    },
    async ensurePostsLoaded() {
      if (this.posts?.length) return
      await this.fetchPosts()
    },
    async loadPage() {
      this.skip = this.requiredSkipAmount
      await this.fetchPosts()
    },
  },
  getters: {
    pagesAmount: (state) => Math.ceil(state.total / state.limit),
    requiredSkipAmount: (state) => (state.page - 1) * state.limit,
  },
})
