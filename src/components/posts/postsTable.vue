<script lang="ts">
import PostCard from './postCard.vue'
import { usePostsStore } from '@/stores/postsStore'
import type { PostDto } from '@/dto/post/postDto'

export default {
  name: 'PostsTable',
  components: { PostCard },

  data() {
    return {
      postsStore: usePostsStore(),
      searchInput: '',
      searchTimer: null as ReturnType<typeof setTimeout> | null,
      isHydrating: true,
      searchField: 'title' as import('@/api/postApi').PostSearchField,
      searchFieldOptions: [
        { title: 'Заголовок', value: 'title' },
        { title: 'Текст', value: 'body' },
        { title: 'ID автора', value: 'userId' },
      ],
    }
  },

  computed: {
    posts(): PostDto[] {
      return this.postsStore.posts
    },
  },

  async mounted() {
    await this.postsStore.ensurePostsLoaded()
    this.searchInput = this.postsStore.query ?? ''
    this.searchField = this.postsStore.searchField

    // Важно: дать watcher-очереди отработать до снятия флага
    await this.$nextTick()
    this.isHydrating = false
  },

  watch: {
    searchInput(newValue: string) {
      if (this.isHydrating) return

      // ключевой guard: если это просто синхронизация из store, ничего не ищем
      if (newValue.trim() === this.postsStore.query.trim()) return

      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.postsStore.searchPosts(newValue, this.searchField)
      }, 400)
    },
  },

  methods: {
    async onPageChange(page: number) {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
        this.searchTimer = null
      }
      await this.postsStore.loadPage(page)
    },

    async onSearchFieldChange(value: 'title' | 'body' | 'userId') {
      this.searchField = value
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
        this.searchTimer = null
      }
      await this.postsStore.searchPosts(this.searchInput, this.searchField)
    },
  },
}
</script>

<template>
  <div>
    <h1>Posts Table</h1>
    <v-container>
      <v-row class="filters-row" align="center">
        <v-col cols="12" sm="4" md="3" lg="2">
          <v-select
            v-model="searchField"
            :items="searchFieldOptions"
            item-title="title"
            item-value="value"
            label="Искать по"
            density="compact"
            variant="outlined"
            hide-details
            @update:model-value="onSearchFieldChange"
          />
        </v-col>

        <v-col cols="12" sm="8" md="9" lg="10">
          <v-text-field
            v-model="searchInput"
            label="Поиск"
            append-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
      </v-row>

      <v-label>Найдено {{ postsStore.total }} постов</v-label>

      <v-row>
        <v-col v-for="post in posts" :key="post.id" cols="12" sm="6" md="4">
          <PostCard :post="post" />
        </v-col>
      </v-row>

      <v-pagination
        :length="postsStore.pagesAmount"
        :total-visible="5"
        :model-value="postsStore.page"
        @update:model-value="onPageChange"
      />
    </v-container>
  </div>
</template>

<style scoped>
.filters-row {
  row-gap: 8px;
}

.search-select {
  max-width: 200px;
}

.searchbar {
  max-width: 500px;
}
</style>
