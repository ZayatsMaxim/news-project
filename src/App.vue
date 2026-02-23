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

<style>
html,
body,
#app,
.app-container {
  min-height: 100vh;
  background-color: rgb(var(--v-theme-background));
  background-image:
    radial-gradient(
      ellipse 150% 100% at 32% -10%,
      #c03efe 0%,
      rgba(192, 62, 254, 0.4) 30%,
      transparent 65%
    ),
    radial-gradient(
      ellipse 120% 120% at 28% 20%,
      #5e46f8 0%,
      rgba(94, 70, 248, 0.35) 35%,
      transparent 65%
    ),
    radial-gradient(circle 80% at 38% 5%, rgba(192, 62, 254, 0.25) 0%, transparent 55%);
  background-attachment: fixed;
}
</style>
