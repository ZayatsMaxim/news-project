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
  /** Номер поста в списке (1-based). Для поиска в кэше при навигации влево/вправо. */
  position?: number
}

const modalRequestControllerRef = { current: null as AbortController | null }

const EDITED_POST_IDS_STORAGE_KEY = 'post_details_edited_ids'

function getEditedPostIdsFromStorage(): number[] {
  try {
    const raw = sessionStorage.getItem(EDITED_POST_IDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return []
  }
}

function saveEditedPostIdsToStorage(ids: number[]): void {
  try {
    sessionStorage.setItem(EDITED_POST_IDS_STORAGE_KEY, JSON.stringify(ids))
  } catch (e) {
    console.warn('Failed to save edited post ids to sessionStorage', e)
  }
}

export const usePostDetailsStore = defineStore('postDetails', {
  state: () => ({
    modalPostLoading: false,
    modalRequestedPostId: null as number | null,
    /** Кэш загруженных деталей постов. Текущий пост — элемент с post.id === modalRequestedPostId. */
    postDetailsCache: [] as CachedPostDetails[],
    /** Исходные значения полей поста для отката при отмене редактирования. */
    originalTitle: '',
    originalBody: '',
    /** Номер запрошенного поста в списке (1-based). 0 — модалка закрыта. */
    modalPostPosition: 0,
    /** Id постов, отредактированных в этой сессии (дублируется в sessionStorage). */
    editedPostIds: getEditedPostIdsFromStorage(),
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

    /** Пост в модалке был отредактирован в этой сессии (id хранится в sessionStorage). */
    modalPostWasEdited(): boolean {
      if (this.modalRequestedPostId == null) return false
      return this.editedPostIds.includes(this.modalRequestedPostId)
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
     * Загружает пост в модалку: из кэша (по postId или по позиции) или с API.
     * @param position — номер поста в списке (1-based)
     * @param postId — если передан, открытие из списка (загрузка по id); иначе навигация по позиции
     * @param searchContext — контекст текущего поиска (query/field), передаётся извне
     */
    async loadPostForModal(position: number, postId?: number, searchContext?: SearchContext) {
      if (modalRequestControllerRef.current) {
        modalRequestControllerRef.current.abort()
      }
      this.modalPostPosition = position
      this.modalRequestedPostId = postId ?? null
      this.modalPostLoading = true

      const cached =
        postId != null
          ? this.postDetailsCache.find((c) => c.post.id === postId)
          : this.postDetailsCache.find((c) => c.position === position)

      if (cached) {
        if (postId != null && this.modalRequestedPostId !== postId) return
        this.modalRequestedPostId = cached.post.id
        this.modalPostPosition = position
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
            _limit: 1,
            _page: position,
            query: searchContext?.query ?? '',
            field: searchContext?.field ?? 'title',
            signal,
            select: 'id,title,body,userId,tags,views,reactions,tags',
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

        this.postDetailsCache.push({ post, user, comments, position })
        this.modalRequestedPostId = post.id
        this.modalPostPosition = position
      } catch (e) {
        if (!isAbortError(e)) {
          console.error('Error fetching post:', e)
        }
        throw e
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
      this.modalPostPosition = 0
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
              position: prev.position,
            }
          }
        }
        if (!this.editedPostIds.includes(postId)) {
          this.editedPostIds.push(postId)
          saveEditedPostIdsToStorage(this.editedPostIds)
        }
        return updated
      } catch (e) {
        if (!isAbortError(e)) {
          console.error('Error updating post:', e)
        }
        throw e
      }
    },
  },
})
