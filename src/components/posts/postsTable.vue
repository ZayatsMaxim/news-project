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
    onNextPage() {},
  },
}
</script>

<template>
  <div>
    <h1>Posts Table</h1>
    <v-container>
      <v-row>
        <v-col v-for="post in posts" :key="post.id" cols="12" sm="6" md="4">
          <PostCard :post="post" />
        </v-col>
      </v-row>
      <v-pagination
        :length="postsStore.pagesAmount"
        :total-visible="5"
        @next="postsStore.loadPage()"
        @prev="postsStore.loadPage()"
        @update:model-value="(postsStore.$patch({ page: $event }), postsStore.loadPage())"
      ></v-pagination>
    </v-container>
  </div>
</template>
<style scoped></style>
