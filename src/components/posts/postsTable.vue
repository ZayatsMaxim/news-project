<script lang="ts">
import PostCard from './postCard.vue'
import { usePostsStore } from '@/stores/postsStore'
import type { PostDto } from '@/dto/post/postDto'
import type { PostSearchField } from '@/api/postApi'

export default {
  name: 'PostsTable',
  components: { PostCard },

  data() {
    return {
      postsStore: usePostsStore(),
      searchInput: '',
      searchTimer: null as ReturnType<typeof setTimeout> | null,
      isHydrating: true,
      searchField: 'title' as PostSearchField,
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
    this.searchInput = this.postsStore.query
    this.searchField = this.postsStore.searchField

    await this.$nextTick()
    this.isHydrating = false
  },

  beforeUnmount() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },

  watch: {
    searchInput(newValue: string) {
      if (this.isHydrating) return

      if (
        newValue.trim() === this.postsStore.query.trim() &&
        this.searchField === this.postsStore.searchField
      ) {
        return
      }

      if (this.searchTimer) clearTimeout(this.searchTimer)

      const value = newValue
      const field = this.searchField
      this.searchTimer = setTimeout(() => {
        this.postsStore.searchPosts(value, field)
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

    async onSearchFieldChange(value: PostSearchField) {
      this.searchField = value
      if (this.isHydrating) return

      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
        this.searchTimer = null
      }

      await this.postsStore.searchPosts(this.searchInput, value)
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
        <v-col
          v-for="(post, index) in posts"
          :key="`${post.userId}-${post.title}-${index}`"
          cols="12"
          sm="6"
          md="4"
        >
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
</style>
