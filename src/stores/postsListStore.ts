import { defineStore } from 'pinia'
import { invalidateLocalPostsCache } from '@/api/postLocalTitleSearch'
import { getPosts, type PostSearchField } from '@/api/postApi'
import { normalizePostList } from '@/api/mappers/postMapper'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'
import { toFiniteNumber } from '@/utils/number'

const STORAGE_KEY = 'posts_list_store_state'
const SEARCH_FIELDS: PostSearchField[] = ['title', 'body', 'userId']

interface StoredPostsState {
  posts: PostDto[]
  total: number
  skip: number
  page: number
  query: string
  searchField: PostSearchField
}

export const usePostsListStore = defineStore('postsList', {
  state: () => ({
    posts: [] as PostDto[],
    total: 0,
    skip: 0,
    limit: 9,
    page: 1,
    query: '',
    searchField: 'title' as PostSearchField,
    isLoading: false,
    requestController: null as AbortController | null,
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

        const data = JSON.parse(raw) as Partial<StoredPostsState> & { posts?: unknown[] }

        this.posts = normalizePostList(Array.isArray(data.posts) ? data.posts : [])
        this.total = toFiniteNumber(data.total, 0)
        this.skip = toFiniteNumber(data.skip, 0)
        this.page = toFiniteNumber(data.page, 1)
        this.query = typeof data.query === 'string' ? data.query : ''

        const restoredField = data.searchField
        this.searchField = SEARCH_FIELDS.includes(restoredField as PostSearchField)
          ? (restoredField as PostSearchField)
          : 'title'

        return true
      } catch (error) {
        console.warn('Failed to hydrate from sessionStorage', error)
        return false
      }
    },

    async fetchPosts(options: { resetPage?: boolean } = {}) {
      const resetPage = options.resetPage ?? false
      const requestSkip = resetPage ? 0 : this.skip

      if (this.requestController) {
        this.requestController.abort()
      }
      this.requestController = new AbortController()

      this.isLoading = true
      const signal = this.requestController.signal
      try {
        const data: PostResponseDto = await getPosts({
          limit: this.limit,
          skip: requestSkip,
          query: this.query,
          field: this.searchField,
          signal,
        })

        if (signal.aborted) return

        this.posts = data.posts
        this.total = toFiniteNumber(data.total, 0)

        if (resetPage) {
          this.page = 1
          this.skip = 0
        } else {
          this.skip = toFiniteNumber(data.skip, requestSkip)
          this.page = Math.floor(this.skip / this.limit) + 1
        }

        this.saveToStorage()
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Error fetching posts:', error)
        }
      } finally {
        this.isLoading = false
        this.requestController = null
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

    /** Инвалидирует кэш локального поиска по title и перезапрашивает текущий список (явное обновление по действию пользователя). */
    async refreshPosts() {
      invalidateLocalPostsCache()
      await this.fetchPosts({ resetPage: false })
    },
  },
})
