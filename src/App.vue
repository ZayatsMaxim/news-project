<script lang="ts">
import PostsTable from '@/components/posts/postsTable.vue'

export default {
  components: {
    PostsTable,
  },
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>Посты</h1>
      <h2>Список постов от пользователей</h2>
    </header>

    <main class="app-main">
      <PostsTable />
    </main>
  </div>
</template>

<style scoped></style>
