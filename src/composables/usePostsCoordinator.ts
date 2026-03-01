import { computed } from 'vue'
import { deletePost as deletePostApi } from '@/api/postApi'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import { usePostsListStore } from '@/stores/postsListStore'
import { useLoginUserStore } from '@/stores/loginUserStore'
import type { PostDto } from '@/dto/post/postDto'

export function usePostsCoordinator() {
  const listStore = usePostsListStore()
  const detailsStore = usePostDetailsStore()
  const loginUserStore = useLoginUserStore()

  const hasPrevPost = computed(() => {
    return detailsStore.modalPostPosition > 1
  })

  const hasNextPost = computed(() => {
    return listStore.total > 0 && detailsStore.modalPostPosition < listStore.total
  })

  function openPostForModal(postId: number, index: number) {
    /** Глобальная позиция поста в списке (1-based), чтобы при перелистывании в модалке открывался следующий/предыдущий пост по всему списку, а не по текущей странице. */
    const position = (listStore.page - 1) * listStore.limit + index + 1
    return detailsStore.loadPostForModal(position, postId, {
      query: listStore.query,
      field: listStore.searchField,
    })
  }

  async function searchPosts(query: string, field?: string) {
    detailsStore.clearPostDetailsCache()
    await listStore.searchPosts(query, field as Parameters<typeof listStore.searchPosts>[1])
  }

  async function refreshPosts() {
    detailsStore.clearPostDetailsCache()
    await listStore.refreshPosts()
  }

  function openModalForNewPost() {
    detailsStore.openModalForNewPost()
  }

  /** Создать пост из черновика модалки; передаёт ID авторизованного пользователя в стор. */
  async function createModalPost(): Promise<PostDto | null> {
    const authorId = loginUserStore.user?.id
    if (authorId == null) return null
    const created = await detailsStore.createModalPost(authorId)
    if (created) {
      await listStore.refreshPosts()
    }
    return created
  }

  async function saveAndSync(postId: number): Promise<boolean> {
    const updated = await detailsStore.saveChanges(postId)
    if (updated) {
      listStore.updatePostInList(postId, { title: updated.title, body: updated.body })
    }
    return updated !== null
  }

  async function deletePost(postId: number): Promise<void> {
    await deletePostApi(postId)
    listStore.removePostFromList(postId)
    detailsStore.removePostFromCache(postId)
    detailsStore.clearModalPost()
    if (listStore.page > listStore.pagesAmount) {
      listStore.page = Math.max(1, listStore.pagesAmount)
    }
    await listStore.refreshPosts()
  }

  async function goToPrevPost() {
    if (!hasPrevPost.value) return
    await detailsStore.loadPostForModal(detailsStore.modalPostPosition - 1, undefined, {
      query: listStore.query,
      field: listStore.searchField,
    })
  }

  async function goToNextPost() {
    if (!hasNextPost.value) return
    await detailsStore.loadPostForModal(detailsStore.modalPostPosition + 1, undefined, {
      query: listStore.query,
      field: listStore.searchField,
    })
  }

  return {
    listStore,
    detailsStore,
    hasPrevPost,
    hasNextPost,
    openPostForModal,
    openModalForNewPost,
    createModalPost,
    searchPosts,
    refreshPosts,
    saveAndSync,
    deletePost,
    goToPrevPost,
    goToNextPost,
  }
}
