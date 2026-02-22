import { defineStore } from 'pinia'
import { invalidateLocalPostsCache } from '@/api/postLocalTitleSearch'
import { getPosts, getPostIds, type PostSearchField } from '@/api/postApi'
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
    /** Страница, загруженная для навигации в модалке (пост вне текущей страницы таблицы). */
    modalPageSkip: null as number | null,
    /** Id постов на странице модалки (только id, без полных постов). */
    modalPageIds: [] as number[],
  }),

  getters: {
    pagesAmount: (state) => Math.max(1, Math.ceil(state.total / state.limit)),
    requiredSkipAmount: (state) => (state.page - 1) * state.limit,
    /** Страница выдачи (postIds + skip), в которой находится postId; для расчёта prev/next в модалке. */
    postsForModal(state): (postId: number) => { postIds: number[]; skip: number } | null {
      return (postId: number) => {
        const mainIds = state.posts.map((p) => p.id)
        if (mainIds.includes(postId)) return { postIds: mainIds, skip: state.skip }
        if (state.modalPageIds.includes(postId) && state.modalPageSkip != null)
          return { postIds: state.modalPageIds, skip: state.modalPageSkip }
        return null
      }
    },
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
      this.modalPageSkip = null
      this.modalPageIds = []

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

    async refreshPosts() {
      invalidateLocalPostsCache()
      await this.fetchPosts({ resetPage: false })
    },

    /** Загружает только id постов на странице по skip (select=id); для навигации в модалке без полной загрузки. */
    async fetchPostIdsAtSkip(skip: number): Promise<number[]> {
      return getPostIds({
        limit: this.limit,
        skip,
        query: this.query,
        field: this.searchField,
      })
    },

    /** Возвращает id предыдущего поста в выдаче; при переходе на пред. страницу не меняет state списка. */
    async getPrevPostId(currentPostId: number): Promise<number | null> {
      const ctx = this.postsForModal(currentPostId)
      if (!ctx) return null
      const { postIds, skip } = ctx
      const index = postIds.indexOf(currentPostId)
      if (index < 0) return null
      if (index > 0) return postIds[index - 1] ?? null
      if (skip <= 0) return null

      const prevPageSkip = skip - this.limit
      // Предыдущая страница уже в хранилище — не запрашиваем список id
      if (prevPageSkip === this.skip && this.posts.length > 0) {
        const last = this.posts[this.posts.length - 1]
        return last?.id ?? null
      }
      if (prevPageSkip === this.modalPageSkip && this.modalPageIds.length > 0) {
        return this.modalPageIds[this.modalPageIds.length - 1] ?? null
      }
      const prevPageIds = await this.fetchPostIdsAtSkip(prevPageSkip)
      this.modalPageSkip = prevPageSkip
      this.modalPageIds = prevPageIds
      return prevPageIds[prevPageIds.length - 1] ?? null
    },

    /** Возвращает id следующего поста в выдаче; при переходе на след. страницу не меняет state списка. */
    async getNextPostId(currentPostId: number): Promise<number | null> {
      const ctx = this.postsForModal(currentPostId)
      if (!ctx) return null
      const { postIds, skip } = ctx
      const index = postIds.indexOf(currentPostId)
      if (index < 0) return null
      if (index < postIds.length - 1) return postIds[index + 1] ?? null
      if (skip + this.limit >= this.total) return null

      const nextPageSkip = skip + this.limit
      // Следующая страница уже в хранилище — не запрашиваем список id
      if (nextPageSkip === this.skip && this.posts.length > 0) {
        const first = this.posts[0]
        return first?.id ?? null
      }
      if (nextPageSkip === this.modalPageSkip && this.modalPageIds.length > 0) {
        return this.modalPageIds[0] ?? null
      }
      const nextPageIds = await this.fetchPostIdsAtSkip(nextPageSkip)
      this.modalPageSkip = nextPageSkip
      this.modalPageIds = nextPageIds
      return nextPageIds[0] ?? null
    },
  },
})
