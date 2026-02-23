import { defineStore } from 'pinia'
import { getPostById, getPostComments, patchPost, type PatchPostBody } from '@/api/postApi'
import { getUser } from '@/api/userApi'
import type { CommentDto } from '@/dto/post/comment/commentDto'
import type { PostDto } from '@/dto/post/postDto'
import type { UserDto } from '@/dto/user/userDto'
import { usePostsListStore } from '@/stores/postsListStore'

export interface CachedPostDetails {
  post: PostDto
  user: UserDto | null
  comments: CommentDto[]
}

const modalRequestControllerRef = { current: null as AbortController | null }

export const usePostDetailsStore = defineStore('postDetails', {
  state: () => ({
    modalPost: null as PostDto | null,
    modalUser: null as UserDto | null,
    modalComments: [] as CommentDto[],
    modalPostLoading: false,
    modalRequestedPostId: null as number | null,
    /** Кэш загруженных деталей постов (postId -> post, user, comments) */
    postDetailsCache: {} as Record<number, CachedPostDetails>,
    /** Исходные значения полей поста для отката при отмене редактирования. */
    originalTitle: '',
    originalBody: '',
  }),

  getters: {
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

    async saveChanges(postId: number): Promise<boolean> {
      if (!this.modalPost) return false

      const updated = await this.updateModalPost(postId, {
        title: this.modalPost.title ?? '',
        body: this.modalPost.body ?? '',
      })
      if (!updated) return false

      this.originalTitle = updated.title ?? ''
      this.originalBody = updated.body ?? ''

      const postsListStore = usePostsListStore()
      postsListStore.updatePostInList(postId, { title: updated.title, body: updated.body })

      return true
    },

    async fetchPostById(postId: number) {
      if (modalRequestControllerRef.current) {
        modalRequestControllerRef.current.abort()
      }
      this.modalRequestedPostId = postId

      const cached = this.postDetailsCache[postId]
      if (cached) {
        this.modalPost = cached.post
        this.modalUser = cached.user
        this.modalComments = cached.comments
        this.modalPostLoading = false
        modalRequestControllerRef.current = null
        return
      }

      const requestController = new AbortController()
      modalRequestControllerRef.current = requestController
      const signal = requestController.signal

      this.modalPostLoading = true
      this.modalPost = null
      this.modalUser = null
      this.modalComments = []
      try {
        const post = await getPostById(postId, signal)

        const [userResult, commentsResult] = await Promise.allSettled([
          post.userId ? getUser(post.userId, signal) : Promise.resolve(null),
          getPostComments(postId, signal),
        ])

        if (signal.aborted || this.modalRequestedPostId !== postId) return

        const user =
          userResult.status === 'fulfilled' && userResult.value != null ? userResult.value : null
        const comments =
          commentsResult.status === 'fulfilled' ? (commentsResult.value.comments ?? []) : []

        this.modalPost = post
        this.modalUser = user
        this.modalComments = comments

        if (
          userResult.status === 'rejected' &&
          !(userResult.reason instanceof DOMException && userResult.reason.name === 'AbortError')
        ) {
          console.error('Error fetching user:', userResult.reason)
        }
        if (
          commentsResult.status === 'rejected' &&
          !(
            commentsResult.reason instanceof DOMException &&
            commentsResult.reason.name === 'AbortError'
          )
        ) {
          console.error('Error fetching comments:', commentsResult.reason)
        }

        this.postDetailsCache[postId] = { post, user, comments }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          console.error('Error fetching post by id:', e)
        }
      } finally {
        if (this.modalRequestedPostId === postId) {
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
      this.modalPost = null
      this.modalUser = null
      this.modalComments = []
    },

    /**
     * Отправить PATCH с текущими title/body поста, обновить modalPost и кэш.
     * Возвращает обновлённый пост или null при ошибке.
     */
    async updateModalPost(postId: number, payload: PatchPostBody): Promise<PostDto | null> {
      try {
        const updated = await patchPost(postId, payload)
        this.modalPost = updated
        const cached = this.postDetailsCache[postId]
        if (cached) {
          this.postDetailsCache[postId] = { ...cached, post: updated }
        }
        return updated
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          console.error('Error updating post:', e)
        }
        return null
      }
    },
  },
})
