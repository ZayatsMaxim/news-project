<script lang="ts">
import PostsTable from '@/components/posts/postsTable.vue'

export default {
  components: {
    PostsTable,
  },
}
</script>

<template>
  <div>
    <header>
      <h1>Посты</h1>
      <h2>Список постов от пользователей</h2>
    </header>

    <main>
      <PostsTable />
    </main>
  </div>
</template>

<style scoped></style>

<style></style>
