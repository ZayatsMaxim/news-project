<script lang="ts">
import PostsTable from '@/components/posts/postsTable.vue'

export default {
  components: {
    PostsTable,
  },
}
</script>

<template>
  <div class="app-root">
    <header class="app-header">
      <h1>Посты</h1>
      <h2>Список постов от пользователей</h2>
    </header>

    <main class="app-main">
      <PostsTable />
    </main>
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  flex-shrink: 0;
  padding: 16px 24px 0;
}

.app-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>