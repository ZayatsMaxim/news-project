import { defineStore } from 'pinia'
import {
  getPostById,
  getPosts,
  getPostComments,
  patchPost,
  type PatchPostBody,
  type PostSearchField,
} from '@/api/postApi'
import { getUser } from '@/api/userApi'
import type { CommentDto } from '@/dto/post/comment/commentDto'
import type { PostDto } from '@/dto/post/postDto'
import type { UserDto } from '@/dto/user/userDto'
import { isAbortError } from '@/utils/error'

export interface SearchContext {
  query: string
  field: PostSearchField
}

export interface CachedPostDetails {
  post: PostDto
  user: UserDto | null
  comments: CommentDto[]
  /** Заполняется при загрузке по skip (навигация влево/вправо) для поиска в кэше. */
  skip?: number
}

const modalRequestControllerRef = { current: null as AbortController | null }

export const usePostDetailsStore = defineStore('postDetails', {
  state: () => ({
    modalPostLoading: false,
    modalRequestedPostId: null as number | null,
    /** Кэш загруженных деталей постов. Текущий пост — элемент с post.id === modalRequestedPostId. */
    postDetailsCache: [] as CachedPostDetails[],
    /** Исходные значения полей поста для отката при отмене редактирования. */
    originalTitle: '',
    originalBody: '',
    /** Skip текущего поста в виртуальном списке выдачи. Используется для навигации влево/вправо. */
    modalSkip: 0,
  }),

  getters: {
    /** Элемент кэша для текущего запрошенного поста. */
    cachedEntry(state): CachedPostDetails | undefined {
      if (state.modalRequestedPostId == null) return undefined
      return state.postDetailsCache.find((c) => c.post.id === state.modalRequestedPostId)
    },

    modalPost(): PostDto | null {
      return this.cachedEntry?.post ?? null
    },

    modalUser(): UserDto | null {
      return this.cachedEntry?.user ?? null
    },

    modalComments(): CommentDto[] {
      return this.cachedEntry?.comments ?? []
    },

    hasUnsavedChanges(): boolean {
      if (!this.modalPost) return false
      return (
        (this.modalPost.title ?? '') !== this.originalTitle ||
        (this.modalPost.body ?? '') !== this.originalBody
      )
    },
  },

  actions: {
    snapshotOriginal() {
      this.originalTitle = this.modalPost?.title ?? ''
      this.originalBody = this.modalPost?.body ?? ''
    },

    revertEdits() {
      if (this.modalPost) {
        this.modalPost.title = this.originalTitle
        this.modalPost.body = this.originalBody
      }
    },

    async saveChanges(postId: number): Promise<PostDto | null> {
      if (!this.modalPost) return null

      const updated = await this.updateModalPost(postId, {
        title: this.modalPost.title ?? '',
        body: this.modalPost.body ?? '',
      })
      if (!updated) return null

      this.originalTitle = updated.title ?? ''
      this.originalBody = updated.body ?? ''

      return updated
    },

    /**
     * Загружает пост в модалку: из кэша (по postId или по skip) или с API.
     * @param skip — индекс поста в выдаче
     * @param postId — если передан, открытие из списка (загрузка по id); иначе навигация по skip
     * @param searchContext — контекст текущего поиска (query/field), передаётся извне
     */
    async loadPostForModal(skip: number, postId?: number, searchContext?: SearchContext) {
      if (modalRequestControllerRef.current) {
        modalRequestControllerRef.current.abort()
      }
      this.modalSkip = skip
      this.modalRequestedPostId = postId ?? null
      this.modalPostLoading = true

      const cached = postId != null
        ? this.postDetailsCache.find((c) => c.post.id === postId)
        : this.postDetailsCache.find((c) => c.skip === skip)

      if (cached) {
        if (postId != null && this.modalRequestedPostId !== postId) return
        this.modalRequestedPostId = cached.post.id
        this.modalSkip = skip
        this.modalPostLoading = false
        modalRequestControllerRef.current = null
        return
      }

      const requestController = new AbortController()
      modalRequestControllerRef.current = requestController
      const signal = requestController.signal

      try {
        let post: PostDto | undefined

        if (postId != null) {
          post = await getPostById(postId, signal)
          if (signal.aborted || this.modalRequestedPostId !== postId) return
        } else {
          const data = await getPosts({
            limit: 1,
            skip,
            query: searchContext?.query ?? '',
            field: searchContext?.field ?? 'title',
            signal,
          })
          if (signal.aborted) return
          post = data.posts[0]
        }

        if (!post) {
          this.modalPostLoading = false
          return
        }

        const [userResult, commentsResult] = await Promise.allSettled([
          post.userId ? getUser(post.userId, signal) : Promise.resolve(null),
          getPostComments(post.id, signal),
        ])

        if (signal.aborted) return

        const user =
          userResult.status === 'fulfilled' && userResult.value != null ? userResult.value : null
        const comments =
          commentsResult.status === 'fulfilled' ? (commentsResult.value.comments ?? []) : []

        if (userResult.status === 'rejected' && !isAbortError(userResult.reason)) {
          console.error('Error fetching user:', userResult.reason)
        }
        if (commentsResult.status === 'rejected' && !isAbortError(commentsResult.reason)) {
          console.error('Error fetching comments:', commentsResult.reason)
        }

        this.postDetailsCache.push({ post, user, comments, skip })
        this.modalRequestedPostId = post.id
        this.modalSkip = skip
      } catch (e) {
        if (!isAbortError(e)) {
          console.error('Error fetching post:', e)
        }
      } finally {
        if (postId != null) {
          if (this.modalRequestedPostId === postId) this.modalPostLoading = false
        } else {
          this.modalPostLoading = false
        }
        if (modalRequestControllerRef.current === requestController) {
          modalRequestControllerRef.current = null
        }
      }
    },

    clearModalPost() {
      if (modalRequestControllerRef.current) {
        modalRequestControllerRef.current.abort()
        modalRequestControllerRef.current = null
      }
      this.modalRequestedPostId = null
      this.modalPostLoading = false
      this.modalSkip = 0
    },

    /** Очистить кэш деталей постов (вызывается при смене запроса/поля поиска в списке). */
    clearPostDetailsCache() {
      this.postDetailsCache = []
    },

    /**
     * Отправить PATCH с текущими title/body поста, обновить запись в кэше.
     * Возвращает обновлённый пост или null при ошибке.
     */
    async updateModalPost(postId: number, payload: PatchPostBody): Promise<PostDto | null> {
      try {
        const updated = await patchPost(postId, payload)
        const idx = this.postDetailsCache.findIndex((c) => c.post.id === postId)
        if (idx >= 0) {
          const prev = this.postDetailsCache[idx]
          if (prev) {
            this.postDetailsCache[idx] = {
              post: updated,
              user: prev.user,
              comments: prev.comments,
              skip: prev.skip,
            }
          }
        }
        return updated
      } catch (e) {
        if (!isAbortError(e)) {
          console.error('Error updating post:', e)
        }
        return null
      }
    },
  },
})
