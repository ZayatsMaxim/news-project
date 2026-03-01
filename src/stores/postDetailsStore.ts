import { defineStore } from 'pinia'
import {
  getPostById,
  getPosts,
  getPostComments,
  patchPost,
  patchPostViews,
  patchPostReactions,
  patchCommentLikes,
  createPost,
  type PatchPostBody,
  type PostSearchField,
} from '@/api/postApi'
import { getUser } from '@/api/userApi'
import type { CommentDto } from '@/dto/post/comment/commentDto'
import type { PostDto } from '@/dto/post/postDto'
import type { UserDto } from '@/dto/user/userDto'
import { isAbortError } from '@/utils/error'
import { createSessionStorageHelper, validateNumberArray } from '@/utils/sessionStorageHelper'
import { useLoginUserStore } from '@/stores/loginUserStore'
import { usePostsListStore } from '@/stores/postsListStore'

export interface SearchContext {
  query: string
  field: PostSearchField
}

export type UserPostReaction = 'like' | 'dislike'

export interface CachedPostDetails {
  post: PostDto
  user: UserDto | null
  comments: CommentDto[]
  /** Номер поста в списке (1-based). Для поиска в кэше при навигации влево/вправо. */
  position?: number
}

const modalRequestControllerRef = { current: null as AbortController | null }

const editedPostIdsStorage = createSessionStorageHelper(
  'post_details_edited_ids',
  [] as number[],
  validateNumberArray,
)
const viewedPostIdsStorage = createSessionStorageHelper(
  'post_details_viewed_ids',
  [] as number[],
  validateNumberArray,
)

/** Реакции по пользователям: userId -> postId -> 'like' | 'dislike'. */
type UserReactionsMap = Record<string, Record<string, UserPostReaction>>
const USER_REACTIONS_STORAGE_KEY = 'post_user_reactions'

function validateUserReactionsMap(parsed: unknown): UserReactionsMap {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const result: UserReactionsMap = {}
  for (const [userId, inner] of Object.entries(parsed)) {
    if (typeof inner !== 'object' || inner === null || Array.isArray(inner)) continue
    const reactions: Record<string, UserPostReaction> = {}
    for (const [postId, value] of Object.entries(inner)) {
      if (value === 'like' || value === 'dislike') reactions[postId] = value
    }
    result[userId] = reactions
  }
  return result
}

function loadAllUserReactions(): UserReactionsMap {
  try {
    const raw = sessionStorage.getItem(USER_REACTIONS_STORAGE_KEY)
    if (!raw) return {}
    return validateUserReactionsMap(JSON.parse(raw))
  } catch {
    return {}
  }
}

function saveAllUserReactions(map: UserReactionsMap): void {
  try {
    sessionStorage.setItem(USER_REACTIONS_STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn(`Failed to save "${USER_REACTIONS_STORAGE_KEY}" to sessionStorage`, e)
  }
}

/** Лайки комментариев по пользователям: userId -> commentIds[]. */
type LikedCommentsMap = Record<string, number[]>
const LIKED_COMMENTS_STORAGE_KEY = 'post_liked_comments'

function loadAllLikedComments(): LikedCommentsMap {
  try {
    const raw = sessionStorage.getItem(LIKED_COMMENTS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const result: LikedCommentsMap = {}
    for (const [userId, arr] of Object.entries(parsed)) {
      result[userId] = validateNumberArray(arr)
    }
    return result
  } catch {
    return {}
  }
}

function saveAllLikedComments(map: LikedCommentsMap): void {
  try {
    sessionStorage.setItem(LIKED_COMMENTS_STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn(`Failed to save "${LIKED_COMMENTS_STORAGE_KEY}" to sessionStorage`, e)
  }
}

function userIdKey(userId: number | null): string {
  return userId != null ? String(userId) : 'guest'
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return []
  return tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
}

export const usePostDetailsStore = defineStore('postDetails', {
  state: () => ({
    modalPostLoading: false,
    modalRequestedPostId: null as number | null,
    /** Черновик нового поста; при открытии модалки «Добавить» — пустой пост, иначе null. */
    modalNewPostDraft: null as PostDto | null,
    /** Кэш загруженных деталей постов. Текущий пост — элемент с post.id === modalRequestedPostId. */
    postDetailsCache: [] as CachedPostDetails[],
    /** Исходные значения полей поста для отката при отмене редактирования. */
    originalTitle: '',
    originalBody: '',
    originalTags: [] as string[],
    /** Номер запрошенного поста в списке (1-based). 0 — модалка закрыта. */
    modalPostPosition: 0,
    /** Id постов, отредактированных в этой сессии (дублируется в sessionStorage). */
    editedPostIds: editedPostIdsStorage.load(),
    /** Id постов, просмотренных в этой сессии (дублируется в sessionStorage). */
    viewedPostIds: viewedPostIdsStorage.load(),
    /** Реакции текущего пользователя на посты (postId -> 'like' | 'dislike'). Загружаются через loadReactionsForUser(userId). */
    userReactions: {} as Record<string, UserPostReaction>,
    /** Id комментариев, лайкнутых текущим пользователем. Загружаются через loadReactionsForUser(userId). */
    likedCommentIds: [] as number[],
  }),

  getters: {
    /** Элемент кэша для текущего запрошенного поста. */
    cachedEntry(state): CachedPostDetails | undefined {
      if (state.modalRequestedPostId == null) return undefined
      return state.postDetailsCache.find((c) => c.post.id === state.modalRequestedPostId)
    },

    modalPost(): PostDto | null {
      return this.modalNewPostDraft ?? this.cachedEntry?.post ?? null
    },

    /** Модалка открыта для создания нового поста (пустой черновик). */
    isModalNewPost(): boolean {
      return this.modalNewPostDraft != null
    },

    modalUser(): UserDto | null {
      return this.cachedEntry?.user ?? null
    },

    modalComments(): CommentDto[] {
      return this.cachedEntry?.comments ?? []
    },

    hasUnsavedChanges(): boolean {
      if (!this.modalPost) return false
      const tagsEqual =
        JSON.stringify([...(this.modalPost.tags ?? [])].sort()) ===
        JSON.stringify([...this.originalTags].sort())
      return (
        (this.modalPost.title ?? '') !== this.originalTitle ||
        (this.modalPost.body ?? '') !== this.originalBody ||
        !tagsEqual
      )
    },

    /** Пост в модалке был отредактирован в этой сессии (id хранится в sessionStorage). */
    modalPostWasEdited(): boolean {
      if (this.modalRequestedPostId == null) return false
      return this.editedPostIds.includes(this.modalRequestedPostId)
    },

    /** Реакция текущего пользователя на пост в модалке. */
    modalPostUserReaction(): UserPostReaction | null {
      if (this.modalRequestedPostId == null) return null
      return this.userReactions[String(this.modalRequestedPostId)] ?? null
    },

    isCommentLiked() {
      return (commentId: number) => this.likedCommentIds.includes(commentId)
    },
  },

  actions: {
    snapshotOriginal() {
      this.originalTitle = this.modalPost?.title ?? ''
      this.originalBody = this.modalPost?.body ?? ''
      if (this.modalPost) {
        if (!Array.isArray(this.modalPost.tags)) this.modalPost.tags = []
        this.originalTags = [...this.modalPost.tags]
      } else {
        this.originalTags = []
      }
    },

    revertEdits() {
      if (this.modalPost) {
        this.modalPost.title = this.originalTitle
        this.modalPost.body = this.originalBody
        this.modalPost.tags = [...this.originalTags]
      }
    },

    async saveChanges(postId: number): Promise<PostDto | null> {
      if (!this.modalPost) return null

      const updated = await this.updateModalPost(postId, {
        title: this.modalPost.title ?? '',
        body: this.modalPost.body ?? '',
        tags: normalizeTags(this.modalPost.tags),
      })
      if (!updated) return null

      this.originalTitle = updated.title ?? ''
      this.originalBody = updated.body ?? ''

      return updated
    },

    async toggleCommentLike(commentId: number) {
      const cached = this.cachedEntry
      if (!cached) return

      const comment = cached.comments.find((c) => c.id === commentId)
      if (!comment) return

      const wasLiked = this.likedCommentIds.includes(commentId)
      const oldLikes = comment.likes
      const newLikes = wasLiked ? Math.max(0, oldLikes - 1) : oldLikes + 1

      comment.likes = newLikes
      if (wasLiked) {
        this.likedCommentIds = this.likedCommentIds.filter((id) => id !== commentId)
      } else {
        this.likedCommentIds.push(commentId)
      }
      const loginStore = useLoginUserStore()
      const uid = loginStore.user?.id ?? null
      const key = userIdKey(uid)
      const all = loadAllLikedComments()
      all[key] = [...this.likedCommentIds]
      saveAllLikedComments(all)

      try {
        await patchCommentLikes(commentId, newLikes)
      } catch (e) {
        comment.likes = oldLikes
        if (wasLiked) {
          this.likedCommentIds.push(commentId)
        } else {
          this.likedCommentIds = this.likedCommentIds.filter((id) => id !== commentId)
        }
        const allRollback = loadAllLikedComments()
        allRollback[key] = [...this.likedCommentIds]
        saveAllLikedComments(allRollback)
        if (!isAbortError(e)) console.error('Error toggling comment like:', e)
      }
    },

    /**
     * Загружает пост в модалку: из кэша (по postId или по позиции) или с API.
     * @param position — номер поста в списке (1-based)
     * @param postId — если передан, открытие из списка (загрузка по id); иначе навигация по позиции
     * @param searchContext — контекст текущего поиска (query/field), передаётся извне
     */
    async loadPostForModal(position: number, postId?: number, searchContext?: SearchContext) {
      if (this.modalRequestedPostId != null) {
        this.incrementViews(this.modalRequestedPostId)
      }
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
            select: 'id,title,body,userId,views,reactions,tags',
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
      if (this.modalRequestedPostId != null) {
        this.incrementViews(this.modalRequestedPostId)
      }
      if (modalRequestControllerRef.current) {
        modalRequestControllerRef.current.abort()
        modalRequestControllerRef.current = null
      }
      this.modalRequestedPostId = null
      this.modalNewPostDraft = null
      this.modalPostLoading = false
      this.modalPostPosition = 0
    },

    /** Открыть модалку для создания нового поста (пустые поля). */
    openModalForNewPost() {
      if (modalRequestControllerRef.current) {
        modalRequestControllerRef.current.abort()
        modalRequestControllerRef.current = null
      }
      this.modalRequestedPostId = null
      this.modalPostPosition = 0
      this.modalPostLoading = false
      this.modalNewPostDraft = {
        id: 0,
        title: '',
        body: '',
        userId: 1,
        views: 0,
        reactions: { likes: 0, dislikes: 0 },
        tags: [],
      }
    },

    /**
     * Создать пост из черновика модалки, записать ответ в стор и перевести модалку в режим просмотра.
     * @param authorId — ID авторизованного пользователя (подставляется в userId перед отправкой).
     */
    async createModalPost(authorId: number): Promise<PostDto | null> {
      const draft = this.modalNewPostDraft
      if (!draft) return null

      const payload: PostDto = {
        ...draft,
        userId: authorId,
        title: (draft.title ?? '').trim(),
        body: (draft.body ?? '').trim(),
        tags: normalizeTags(draft.tags),
      }
      const created = await createPost(payload)

      let user: UserDto | null = null
      try {
        user = (await getUser(created.userId)) ?? null
      } catch (e) {
        if (!isAbortError(e)) console.error('Error fetching user for created post:', e)
      }

      this.modalNewPostDraft = null
      this.postDetailsCache.push({ post: created, user, comments: [] })
      this.modalRequestedPostId = created.id
      this.modalPostPosition = 0
      this.originalTitle = created.title ?? ''
      this.originalBody = created.body ?? ''
      this.originalTags = created.tags ? [...created.tags] : []

      return created
    },

    /** Очистить кэш деталей постов (вызывается при смене запроса/поля поиска в списке). */
    clearPostDetailsCache() {
      this.postDetailsCache = []
    },

    /** Удалить пост из кэша после удаления на сервере. Убирает postId из editedPostIds. */
    removePostFromCache(postId: number) {
      const index = this.postDetailsCache.findIndex((c) => c.post.id === postId)
      if (index !== -1) this.postDetailsCache.splice(index, 1)
      const editedIndex = this.editedPostIds.indexOf(postId)
      if (editedIndex !== -1) {
        this.editedPostIds.splice(editedIndex, 1)
        editedPostIdsStorage.save(this.editedPostIds)
      }
    },

    /**
     * Загрузить реакции и лайки комментариев для указанного пользователя из sessionStorage.
     * Вызывать при входе/выходе и смене аккаунта (например, из HomeView при изменении loginUserStore.user).
     */
    loadReactionsForUser(userId: number | null) {
      const key = userIdKey(userId)
      const allReactions = loadAllUserReactions()
      this.userReactions = { ...(allReactions[key] ?? {}) }
      const allLiked = loadAllLikedComments()
      this.likedCommentIds = [...(allLiked[key] ?? [])]
    },

    async toggleReaction(postId: number, reaction: UserPostReaction) {
      const cached = this.postDetailsCache.find((c) => c.post.id === postId)
      if (!cached) return

      const current = this.userReactions[String(postId)] ?? null
      const { likes, dislikes } = cached.post.reactions

      let newLikes = likes
      let newDislikes = dislikes
      let newReaction: UserPostReaction | null

      if (current === reaction) {
        if (reaction === 'like') newLikes = Math.max(0, likes - 1)
        else newDislikes = Math.max(0, dislikes - 1)
        newReaction = null
      } else {
        if (current === 'like') newLikes = Math.max(0, likes - 1)
        else if (current === 'dislike') newDislikes = Math.max(0, dislikes - 1)

        if (reaction === 'like') newLikes += 1
        else newDislikes += 1
        newReaction = reaction
      }

      cached.post.reactions = { likes: newLikes, dislikes: newDislikes }
      if (newReaction) {
        this.userReactions[String(postId)] = newReaction
      } else {
        delete this.userReactions[String(postId)]
      }
      const loginStore = useLoginUserStore()
      const uid = loginStore.user?.id ?? null
      const key = userIdKey(uid)
      const all = loadAllUserReactions()
      all[key] = { ...this.userReactions }
      saveAllUserReactions(all)

      try {
        await patchPostReactions(postId, { likes: newLikes, dislikes: newDislikes })
      } catch (e) {
        cached.post.reactions = { likes, dislikes }
        if (current) {
          this.userReactions[String(postId)] = current
        } else {
          delete this.userReactions[String(postId)]
        }
        const allRollback = loadAllUserReactions()
        allRollback[key] = { ...this.userReactions }
        saveAllUserReactions(allRollback)
        if (!isAbortError(e)) console.error('Error toggling reaction:', e)
      }
    },

    async incrementViews(postId: number) {
      if (this.viewedPostIds.includes(postId)) return

      const cached = this.postDetailsCache.find((c) => c.post.id === postId)
      const currentViews = cached?.post.views ?? 0

      try {
        await patchPostViews(postId, currentViews + 1)
        const newViews = currentViews + 1
        if (cached) {
          cached.post.views = newViews
        }
        usePostsListStore().updatePostInList(postId, { views: newViews })
        this.viewedPostIds.push(postId)
        viewedPostIdsStorage.save(this.viewedPostIds)
      } catch (e) {
        if (!isAbortError(e)) {
          console.error('Error incrementing views:', e)
        }
      }
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
          editedPostIdsStorage.save(this.editedPostIds)
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
