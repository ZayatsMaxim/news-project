import { defineStore } from 'pinia'
import { getPosts, type PostSearchField } from '@/api/postApi'
import { mapPostsListToDto } from '@/api/mappers/postMapper'
import { apiConfig } from '@/config/api'
import type { PostDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'
import { isAbortError, getHttpStatus } from '@/utils/error'
import { toFiniteNumber } from '@/utils/number'

const STORAGE_KEY = 'posts_list_store_state'
const SEARCH_FIELDS: PostSearchField[] = ['title', 'body', 'userId']

/** Лимит постов на одной странице списка (используется по умолчанию в store и при расчёте числа страниц). */
export const POSTS_PAGE_LIMIT = 9

const requestControllerRef = { current: null as AbortController | null }

interface StoredPostsState {
  posts: PostDto[]
  page: number
  query: string
  searchField: PostSearchField
  total: number
  totalPages: number
}

export const usePostsListStore = defineStore('postsList', {
  state: () => ({
    posts: [] as PostDto[],
    limit: POSTS_PAGE_LIMIT,
    page: 1,
    query: '',
    searchField: 'title' as PostSearchField,
    total: 0,
    totalPages: 1,
    isLoading: false,
  }),

  getters: {
    /** Общее число страниц (из заголовка Link, rel="last", в ответе getPosts). */
    pagesAmount(): number {
      return Math.max(1, this.totalPages)
    },
  },

  actions: {
    /** Пересчитывает totalPages по total и limit. */
    recalculateTotalPages() {
      this.totalPages = Math.max(1, Math.ceil(this.total / this.limit))
    },

    saveToStorage() {
      try {
        const stateToSave: StoredPostsState = {
          posts: this.posts,
          page: this.page,
          query: this.query,
          searchField: this.searchField,
          total: this.total,
          totalPages: this.totalPages,
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

        this.posts = mapPostsListToDto(Array.isArray(data.posts) ? data.posts : [])
        this.page = toFiniteNumber(data.page, 1)
        this.query = typeof data.query === 'string' ? data.query : ''
        this.total = toFiniteNumber(data.total, 0)
        this.totalPages = toFiniteNumber(data.totalPages, 1)

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

      if (requestControllerRef.current) {
        requestControllerRef.current.abort()
      }
      requestControllerRef.current = new AbortController()

      if (resetPage) {
        this.page = 1
      }

      this.isLoading = true
      const signal = requestControllerRef.current.signal
      try {
        const data: PostResponseDto = await getPosts({
          _limit: this.limit,
          _page: this.page,
          query: this.query,
          field: this.searchField,
          signal,
          select: apiConfig.postsSelect,
        })

        if (signal.aborted) return

        this.posts = data.posts
        this.total = data.total ?? data.posts.length
        if (data.totalPages !== undefined && data.totalPages !== null) {
          this.totalPages = data.totalPages
        } else {
          this.recalculateTotalPages()
        }

        this.saveToStorage()
      } catch (error) {
        if (!isAbortError(error) && getHttpStatus(error) === 404 && this.searchField === 'userId') {
          this.posts = []
          this.page = 1
          this.total = 0
          this.recalculateTotalPages()
          this.saveToStorage()
        } else {
          throw error
        }
      } finally {
        this.isLoading = false
        requestControllerRef.current = null
      }
    },

    async searchPosts(query: string, field?: PostSearchField) {
      this.query = query.trim()
      this.searchField = field ?? this.searchField
      await this.fetchPosts({ resetPage: true })
    },

    async loadPage(page: number) {
      this.page = page
      await this.fetchPosts()
    },

    async ensurePostsLoaded() {
      if (this.hydrateFromStorage()) return
      await this.fetchPosts()
    },

    updatePostInList(postId: number, fields: { title?: string; body?: string; views?: number }) {
      const post = this.posts.find((p) => p.id === postId)
      if (!post) return
      if (fields.title !== undefined) post.title = fields.title
      if (fields.body !== undefined) post.body = fields.body
      if (fields.views !== undefined) post.views = fields.views
      this.saveToStorage()
    },

    /** Удаляет пост из списка после удаления на сервере. Уменьшает total и пересчитывает totalPages. */
    removePostFromList(postId: number) {
      const index = this.posts.findIndex((p) => p.id === postId)
      if (index === -1) return
      this.posts.splice(index, 1)
      if (this.total > 0) {
        this.total -= 1
        this.recalculateTotalPages()
      }
      this.saveToStorage()
    },

    async refreshPosts() {
      await this.fetchPosts({ resetPage: false })
    },
  },
})
