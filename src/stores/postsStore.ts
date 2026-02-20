import { defineStore } from 'pinia'
import { getPosts, type PostSearchField } from '@/api/postApi'
import type { PostDto, PostReactionsDto } from '@/dto/post/postDto'
import type { PostResponseDto } from '@/dto/post/postResponseDto'

const STORAGE_KEY = 'posts_store_state'
const SEARCH_FIELDS: PostSearchField[] = ['title', 'body', 'userId']

interface StoredPostsState {
  posts: PostDto[]
  total: number
  skip: number
  page: number
  query: string
  searchField: PostSearchField
}

interface RawPost {
  id?: unknown
  title?: unknown
  body?: unknown
  userId?: unknown
  views?: unknown
  reactions?: {
    likes?: unknown
    dislikes?: unknown
  }
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeReactions(raw: RawPost['reactions']): PostReactionsDto {
  return {
    likes: toFiniteNumber(raw?.likes, 0),
    dislikes: toFiniteNumber(raw?.dislikes, 0),
  }
}

function normalizePosts(rawPosts: unknown[]): PostDto[] {
  return rawPosts.map((raw) => {
    const post = (typeof raw === 'object' && raw !== null ? raw : {}) as RawPost
    return {
      id: toFiniteNumber(post.id, 0),
      title: typeof post.title === 'string' ? post.title : '',
      body: typeof post.body === 'string' ? post.body : '',
      userId: toFiniteNumber(post.userId, 0),
      views: toFiniteNumber(post.views, 0),
      reactions: normalizeReactions(post.reactions),
    }
  })
}

export const usePostsStore = defineStore('posts', {
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

        this.posts = normalizePosts(Array.isArray(data.posts) ? data.posts : [])
        this.total = toFiniteNumber(data.total, 0)
        this.skip = toFiniteNumber(data.skip, 0)
        this.page = toFiniteNumber(data.page, 1)
        this.query = typeof data.query === 'string' ? data.query : ''

        const restoredField = data.searchField
        this.searchField = SEARCH_FIELDS.includes(restoredField as PostSearchField)
          ? (restoredField as PostSearchField)
          : 'title'

        return this.posts.length > 0
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
      try {
        const data: PostResponseDto = await getPosts({
          limit: this.limit,
          skip: requestSkip,
          query: this.query,
          field: this.searchField,
          signal: this.requestController.signal,
        })

        this.posts = normalizePosts(Array.isArray(data.posts) ? (data.posts as unknown[]) : [])
        this.total = toFiniteNumber(data.total, 0)

        if (resetPage) {
          this.page = 1
          this.skip = 0
        } else {
          this.skip = toFiniteNumber(data.skip, requestSkip)
        }

        this.saveToStorage()
      } catch (error) {
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