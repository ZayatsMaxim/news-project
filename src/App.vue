<script setup lang="ts">
import PostsTable from '@/components/posts/postsTable.vue'
</script>

<template>
  <div class="d-flex flex-column overflow-hidden" style="height: 100vh">
    <v-container
      ><header class="flex-shrink-0">
        <div class="text-h4">Новости</div>
        <div class="text-subtitle-2 text-medium-emphasis">Последние новости от пользователей</div>
      </header>
    </v-container>

    <main class="flex-fill min-height-0 d-flex flex-column">
      <PostsTable />
    </main>
  </div>
</template>

<style scoped>
.min-height-0 {
  min-height: 0;
}

.flex-fill {
  flex: 1 1 auto;
}

.flex-shrink-0 {
  flex-shrink: 0;
}
</style>
