<script lang="ts">
import { mapStores } from 'pinia'
import PostCard from './postCard.vue'
import PostDetailsModal from './postDetailsModal.vue'
import { usePostsListStore } from '@/stores/postsListStore'
import { usePostsCoordinator } from '@/composables/usePostsCoordinator'
import type { PostDto } from '@/dto/post/postDto'

let coordinator: ReturnType<typeof usePostsCoordinator> | null = null

export default {
  name: 'PostsTable',
  components: { PostCard, PostDetailsModal },

  computed: {
    ...mapStores(usePostsListStore),
    posts(): PostDto[] {
      return this.postsListStore.posts
    },
  },

  data() {
    return {
      searchTimer: null as ReturnType<typeof setTimeout> | null,
      isHydrating: true,
      isPostModalOpen: false,
      searchFieldOptions: [
        { title: 'Заголовок', value: 'title' },
        { title: 'Текст', value: 'body' },
        { title: 'ID автора', value: 'userId' },
      ],
    }
  },

  created() {
    coordinator = usePostsCoordinator()
  },

  async mounted() {
    await this.postsListStore.ensurePostsLoaded()
    await this.$nextTick()
    this.isHydrating = false
  },

  beforeUnmount() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },

  watch: {
    'postsListStore.query'() {
      if (this.isHydrating) return
      if (this.searchTimer) clearTimeout(this.searchTimer)
      const query = this.postsListStore.query
      const field = this.postsListStore.searchField
      this.searchTimer = setTimeout(() => {
        coordinator!.searchPosts(query, field)
      }, 400)
    },
    'postsListStore.searchField'() {
      if (this.isHydrating) return
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
        this.searchTimer = null
      }
      coordinator!.searchPosts(this.postsListStore.query, this.postsListStore.searchField)
    },
  },

  methods: {
    openPostModal(postId: number, index: number) {
      coordinator!.openPostForModal(postId, index)
      this.isPostModalOpen = true
    },

    async onPageChange(page: number) {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
        this.searchTimer = null
      }
      await this.postsListStore.loadPage(page)
    },

    async onRefresh() {
      await coordinator!.refreshPosts()
    },
  },
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
