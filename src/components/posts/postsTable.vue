<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, provide } from 'vue'
import PostCard from './postCard.vue'
import PostDetailsModal from './postDetailsModal.vue'
import { usePostsListStore } from '@/stores/postsListStore'
import { usePostsCoordinator } from '@/composables/usePostsCoordinator'
import { useErrorSnackbar } from '@/composables/useErrorSnackbar'
import { isAbortError } from '@/utils/error'

const postsListStore = usePostsListStore()
const coordinator = usePostsCoordinator()
const { snackbarVisible, snackbarMessage, showSnackbar, closeSnackbar } = useErrorSnackbar()
provide('errorSnackbar', { showSnackbar, closeSnackbar })

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
        if (!isAbortError(e)) showSnackbar('Ошибка загрузки списка постов')
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
        if (!isAbortError(e)) showSnackbar('Ошибка загрузки списка постов')
      }
    })()
  },
  { flush: 'post' },
)

onMounted(async () => {
  try {
    await postsListStore.ensurePostsLoaded()
  } catch (e) {
    if (!isAbortError(e)) showSnackbar('Ошибка загрузки списка постов')
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
        if (!isAbortError(e)) showSnackbar('Ошибка загрузки поста')
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
    if (!isAbortError(e)) showSnackbar('Ошибка загрузки списка постов')
  }
}

async function onRefresh() {
  try {
    await coordinator.refreshPosts()
  } catch (e) {
    if (!isAbortError(e)) showSnackbar('Ошибка загрузки списка постов')
  }
}
</script>

<template>
  <div class="page-layout">
    <v-container class="toolbar">
      <v-row class="filters-row" align="center">
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

        <v-col cols="12" sm="auto">
          <v-btn
            color="primary"
            variant="outlined"
            :loading="postsListStore.isLoading"
            :disabled="postsListStore.isLoading"
            @click="onRefresh"
          >
            Обновить
          </v-btn>
        </v-col>
      </v-row>

      <v-label>Найдено {{ postsListStore.total }} постов</v-label>
    </v-container>

    <div class="content-area">
      <v-container v-if="postsListStore.isLoading" class="loader-wrap">
        <v-progress-circular indeterminate size="48" />
      </v-container>
      <v-container v-else>
        <v-row class="cards-row">
          <v-col v-for="(post, index) in posts" :key="post.id" cols="12" sm="6" md="4">
            <PostCard :post="post" @open="openPostModal(post.id, index)" />
          </v-col>
        </v-row>
      </v-container>
    </div>

    <PostDetailsModal v-model="isPostModalOpen" />

    <v-snackbar
      v-model="snackbarVisible"
      :text="snackbarMessage"
      color="error"
      location="bottom"
      @update:model-value="(v: boolean) => !v && closeSnackbar()"
    >
      <template #actions>
        <v-btn variant="text" @click="closeSnackbar">Закрыть</v-btn>
      </template>
    </v-snackbar>

    <v-container class="footer">
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
.page-layout {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.toolbar {
  flex-shrink: 0;
}

.filters-row {
  row-gap: 8px;
}

.content-area {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.loader-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.footer {
  flex-shrink: 0;
}

.cards-row :deep(.v-col) {
  display: flex;
}
</style>
