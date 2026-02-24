import { computed } from 'vue'
import { invalidateLocalPostsCache } from '@/api/postLocalTitleSearch'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import { usePostsListStore } from '@/stores/postsListStore'

export function usePostsCoordinator() {
  const listStore = usePostsListStore()
  const detailsStore = usePostDetailsStore()

  const hasPrevPost = computed(() => {
    return detailsStore.modalSkip > 0
  })

  const hasNextPost = computed(() => {
    return listStore.total > 0 && detailsStore.modalSkip < listStore.total - 1
  })

  function openPostForModal(postId: number, index: number) {
    const skip = listStore.skip + index
    detailsStore.loadPostForModal(skip, postId, {
      query: listStore.query,
      field: listStore.searchField,
    })
  }

  async function searchPosts(query: string, field?: string) {
    detailsStore.clearPostDetailsCache()
    await listStore.searchPosts(query, field as Parameters<typeof listStore.searchPosts>[1])
  }

  async function refreshPosts() {
    invalidateLocalPostsCache()
    detailsStore.clearPostDetailsCache()
    await listStore.refreshPosts()
  }

  async function saveAndSync(postId: number): Promise<boolean> {
    const updated = await detailsStore.saveChanges(postId)
    if (updated) {
      listStore.updatePostInList(postId, { title: updated.title, body: updated.body })
    }
    return updated !== null
  }

  async function goToPrevPost() {
    if (!hasPrevPost.value) return
    await detailsStore.loadPostForModal(detailsStore.modalSkip - 1, undefined, {
      query: listStore.query,
      field: listStore.searchField,
    })
  }

  async function goToNextPost() {
    if (!hasNextPost.value) return
    await detailsStore.loadPostForModal(detailsStore.modalSkip + 1, undefined, {
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
    searchPosts,
    refreshPosts,
    saveAndSync,
    goToPrevPost,
    goToNextPost,
  }
}
