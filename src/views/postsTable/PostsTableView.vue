<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

import { usePostsListStore } from '@/stores/postsListStore'
import { usePostsCoordinator } from '@/composables/usePostsCoordinator'
import { useErrorSnackbar } from '@/composables/useErrorSnackbar'
import { isAbortError } from '@/utils/error'
import {
  SNACKBAR_ERROR_POST_LOAD_FAILED,
  SNACKBAR_ERROR_POSTS_LIST_LOAD_FAILED,
} from '@/constants/snackbarErrorMessages'

import PostCard from '@/components/posts/postCard.vue'
import PostDetailsModal from '@/components/posts/postDetailsModal.vue'

const postsListStore = usePostsListStore()
const coordinator = usePostsCoordinator()
const { showSnackbar } = useErrorSnackbar()

const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const isHydrating = ref(true)
const isPostModalOpen = ref(false)

const searchFieldOptions = [
  { title: 'Заголовок', value: 'title' },
  { title: 'Текст', value: 'body' },
  { title: 'ID автора', value: 'userId' },
] as const

const posts = computed(() => postsListStore.posts)

watch(
  () => postsListStore.query,
  () => {
    if (isHydrating.value) return
    if (searchTimer.value) clearTimeout(searchTimer.value)
    const query = postsListStore.query
    const field = postsListStore.searchField
    searchTimer.value = setTimeout(async () => {
      try {
        await coordinator.searchPosts(query, field)
      } catch (e) {
        if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POSTS_LIST_LOAD_FAILED)
      }
    }, 400)
  },
  { flush: 'post' },
)

watch(
  () => postsListStore.searchField,
  () => {
    if (isHydrating.value) return
    if (searchTimer.value) {
      clearTimeout(searchTimer.value)
      searchTimer.value = null
    }
    ;(async () => {
      try {
        await coordinator.searchPosts(postsListStore.query, postsListStore.searchField)
      } catch (e) {
        if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POSTS_LIST_LOAD_FAILED)
      }
    })()
  },
  { flush: 'post' },
)

onMounted(async () => {
  try {
    await postsListStore.ensurePostsLoaded()
  } catch (e) {
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POSTS_LIST_LOAD_FAILED)
  }
  await nextTick()
  isHydrating.value = false
})

onBeforeUnmount(() => {
  if (searchTimer.value) clearTimeout(searchTimer.value)
})

async function openPostModal(postId: number, index: number) {
  isPostModalOpen.value = true
  try {
    await coordinator.openPostForModal(postId, index)
  } catch (e) {
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POST_LOAD_FAILED)
  }
}

async function onPageChange(page: number) {
  if (searchTimer.value) {
    clearTimeout(searchTimer.value)
    searchTimer.value = null
  }
  try {
    await postsListStore.loadPage(page)
  } catch (e) {
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POSTS_LIST_LOAD_FAILED)
  }
}

async function onRefresh() {
  try {
    await coordinator.refreshPosts()
  } catch (e) {
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POSTS_LIST_LOAD_FAILED)
  }
}
</script>

<template>
  <div class="d-flex flex-column flex-fill min-height-0 overflow-hidden">
    <v-container class="flex-shrink-0">
      <v-row align="center" class="ga-2">
        <v-col cols="12" sm="4" md="3" lg="2">
          <v-select
            v-model="postsListStore.searchField"
            :items="searchFieldOptions"
            item-title="title"
            item-value="value"
            label="Искать по"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>

        <v-col cols="12" sm="6" md="7" lg="8">
          <v-text-field
            v-model="postsListStore.query"
            label="Поиск"
            append-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>

        <v-col cols="12" sm="auto" class="d-flex ga-5 justify-end">
          <v-btn
            icon="mdi-refresh"
            color="primary"
            variant="plain"
            :loading="postsListStore.isLoading"
            :disabled="postsListStore.isLoading"
            aria-label="Обновить"
            @click="onRefresh"
          />
        </v-col>
      </v-row>

      <v-label>Найдено {{ postsListStore.total }} постов</v-label>
    </v-container>

    <div class="flex-fill min-height-0 overflow-y-auto">
      <v-container
        v-if="postsListStore.isLoading"
        class="d-flex align-center justify-center"
        style="height: 100%"
      >
        <v-progress-circular indeterminate size="48" />
      </v-container>
      <v-container v-else>
        <div
          v-if="posts.length === 0"
          class="d-flex align-center justify-center text-medium-emphasis"
        >
          Посты по запросу не найдены
        </div>
        <v-row v-else>
          <v-col
            v-for="(post, index) in posts"
            :key="post.id"
            cols="12"
            sm="6"
            md="4"
            class="d-flex"
          >
            <PostCard :post="post" @open="openPostModal(post.id, index)" />
          </v-col>
        </v-row>
      </v-container>
    </div>

    <PostDetailsModal v-model="isPostModalOpen" />

    <v-container class="flex-shrink-0">
      <v-pagination
        :length="postsListStore.pagesAmount"
        :total-visible="5"
        :model-value="postsListStore.page"
        @update:model-value="onPageChange"
      />
    </v-container>
  </div>
</template>

<style scoped>
.min-height-0 {
  min-height: 0;
}

.flex-fill {
  flex: 1 1 auto;
}

.flex-shrink-0 {
  flex-shrink: 0;
}
</style>
