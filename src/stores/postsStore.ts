import { defineStore } from 'pinia'
import { getPosts, type PostSearchField } from '@/api/postApi'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'

const STORAGE_KEY = 'posts_store_state'

interface StoredPostsState {
  posts: PostDto[]
  total: number
  skip: number
  page: number
  query: string
  searchField: PostSearchField
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export const usePostsStore = defineStore('posts', {
  state: () => ({
    posts: [] as PostDto[],
    total: 0,
    skip: 0,
    limit: 9,
    page: 1,
    query: '',
    isLoading: false,
    requestController: null as AbortController | null,
    searchField: 'title' as PostSearchField,
  }),

  getters: {
    pagesAmount: (state) => Math.max(1, Math.ceil(state.total / state.limit)),
    requiredSkipAmount: (state) => (state.page - 1) * state.limit,
  },

  actions: {
    saveToStorage() {
      try {
        const stateToSave: StoredPostsState = {
          posts: this.posts,
          total: this.total,
          skip: this.skip,
          page: this.page,
          query: this.query,
          searchField: this.searchField,
        }
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
      } catch (error) {
        console.warn('Failed to save to sessionStorage', error)
      }
    },

    hydrateFromStorage(): boolean {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return false

        const data = JSON.parse(raw) as Partial<StoredPostsState>

        this.posts = Array.isArray(data.posts) ? data.posts : []
        this.total = toFiniteNumber(data.total, 0)
        this.skip = toFiniteNumber(data.skip, 0)
        this.page = toFiniteNumber(data.page, 1)
        this.query = typeof data.query === 'string' ? data.query : ''

        return this.posts.length > 0
      } catch (error) {
        console.warn('Failed to hydrate from sessionStorage', error)
        return false
      }
    },

    async fetchPosts(options: { resetPage?: boolean } = {}) {
      const resetPage = options.resetPage ?? false
      const requestSkip = resetPage ? 0 : this.skip

      // 1) отменяем предыдущий запрос
      if (this.requestController) {
        this.requestController.abort()
      }

      // 2) создаем новый контроллер
      this.requestController = new AbortController()

      this.isLoading = true
      try {
        const data: PostResponseDto = await getPosts({
          limit: this.limit,
          skip: requestSkip,
          query: this.query,
          signal: this.requestController.signal,
          field: this.searchField,
        })

        this.posts = Array.isArray(data.posts) ? data.posts : []
        this.total = toFiniteNumber(data.total, 0)

        if (resetPage) {
          this.page = 1
          this.skip = 0
        } else {
          this.skip = toFiniteNumber(data.skip, requestSkip)
        }

        this.saveToStorage()
      } catch (error) {
        // AbortError — штатная ситуация, не логируем как ошибку
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Error fetching posts:', error)
        }
      } finally {
        this.isLoading = false
      }
    },

    async searchPosts(query: string, field?: PostSearchField) {
      this.query = query.trim()
      this.searchField = field ?? this.searchField
      await this.fetchPosts({ resetPage: true })
    },

    async loadPage(page: number) {
      this.page = page
      this.skip = this.requiredSkipAmount
      await this.fetchPosts()
    },

    async ensurePostsLoaded() {
      if (this.hydrateFromStorage()) return
      await this.fetchPosts()
    },
  },
})
