<script lang="ts">
import { mapStores } from 'pinia'
import PostCard from './postCard.vue'
import PostDetailsModal from './postDetailsModal.vue'
import { usePostsListStore } from '@/stores/postsListStore'
import type { PostDto } from '@/dto/post/postDto'

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
      selectedPostId: null as number | null,
      searchFieldOptions: [
        { title: 'Заголовок', value: 'title' },
        { title: 'Текст', value: 'body' },
        { title: 'ID автора', value: 'userId' },
      ],
    }
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
        this.postsListStore.searchPosts(query, field)
      }, 400)
    },
    'postsListStore.searchField'() {
      if (this.isHydrating) return
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
        this.searchTimer = null
      }
      this.postsListStore.searchPosts(this.postsListStore.query, this.postsListStore.searchField)
    },
  },

  methods: {
    openPostModal(postId: number) {
      this.selectedPostId = postId
      this.isPostModalOpen = true
    },
    navigateModalPost(postId: number) {
      this.selectedPostId = postId
    },

    async onPageChange(page: number) {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
        this.searchTimer = null
      }
      await this.postsListStore.loadPage(page)
    },

    async onRefresh() {
      await this.postsListStore.refreshPosts()
    },
  },
}
</script>

<template>
  <div>
    <v-container>
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

      <v-row>
        <v-col v-for="post in posts" :key="post.id" cols="12" sm="6" md="4">
          <PostCard :post="post" @open="openPostModal(post.id)" />
        </v-col>
      </v-row>

      <PostDetailsModal
        v-model="isPostModalOpen"
        :post-id="selectedPostId"
        @navigate="navigateModalPost"
      />

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
.filters-row {
  row-gap: 8px;
}
</style>
