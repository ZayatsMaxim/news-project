import { defineStore } from 'pinia'
import { PostDto } from '@/dto/post/postDto'
import { PostResponseDto } from '@/dto/post/postResponseDto'

export const usePostsStore = defineStore('posts', {
  state: (): PostResponseDto => ({
    posts: [],
    total: 0,
    skip: 0,
    limit: 10,
  }),
  actions: {
    async fetchPosts() {
      try {
        const response = await fetch('https://dummyjson.com/posts')
        this.posts = await response.json()
      } catch (error) {
        console.error('Error fetching posts:', error)
      }
    },
  },
})
