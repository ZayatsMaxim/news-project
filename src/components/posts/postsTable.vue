<script lang="ts">
import PostCard from './postCard.vue'
import { usePostsStore } from '@/stores/postsStore'
import type { PostDto } from '@/dto/post/postDto'

export default {
  name: 'PostsTable',
  components: {
    PostCard,
  },
  data() {
    return {
      postsStore: usePostsStore(),
      searchInput: '',
      searchTimer: null as ReturnType<typeof setTimeout> | null,
    }
  },
  computed: {
    posts(): PostDto[] {
      return this.postsStore.posts
    },
  },
  mounted() {
    this.postsStore.ensurePostsLoaded()
  },
  methods: {
    async onPageChange(page: number) {
      await this.postsStore.loadPage(page)
    },
    onInput(value: string) {
      this.searchInput = value

      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.postsStore.searchPosts(this.searchInput)
      }, 400)
    },
  },
}
</script>

<template>
  <div>
    <h1>Posts Table</h1>
    <v-container>
      <v-text-field
        class="searchbar"
        append-inner-icon="mdi-magnify"
        label="Поиск по заголовку, тексту или ID пользователя"
        density="compact"
        @update:model-value="onInput($event)"
      ></v-text-field>
      <v-label>Найдено {{ postsStore.total }} постов</v-label>
      <v-row>
        <v-col v-for="post in posts" :key="post.id" cols="12" sm="6" md="4">
          <PostCard :post="post" />
        </v-col>
      </v-row>
      <v-pagination
        :length="postsStore.pagesAmount"
        :total-visible="5"
        @update:model-value="onPageChange($event)"
      ></v-pagination>
    </v-container>
  </div>
</template>
<style scoped>
.searchbar {
  max-width: 500px;
}
</style>
