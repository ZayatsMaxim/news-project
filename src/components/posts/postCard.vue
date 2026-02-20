<script lang="ts">
import type { PostDto } from '@/dto/post/postDto'
import type { PropType } from 'vue'

export default {
  name: 'PostCard',
  props: {
    post: {
      type: Object as PropType<PostDto>,
      required: true,
    },
  },
  computed: {
    truncatedPostBody(): string {
      const text = this.post.body ?? ''
      return text.length > 100 ? text.slice(0, 100) + '...' : text
    },
  },
}
</script>

<template>
  <v-card :title="post.title" :subtitle="`ID автора: ${post.userId}`">
    <v-card-text>
      {{ truncatedPostBody }}
    </v-card-text>

    <div class="meta">
      <span class="meta-item">
        <v-icon icon="mdi-thumb-up-outline" size="18" />
        {{ post.reactions.likes }}
      </span>
      <span class="meta-item">
        <v-icon icon="mdi-thumb-down-outline" size="18" />
        {{ post.reactions.dislikes }}
      </span>
      <span class="meta-item">
        <v-icon icon="mdi-eye-outline" size="18" />
        {{ post.views }}
      </span>
    </div>
  </v-card>
</template>

<style scoped>
.meta {
  display: flex;
  gap: 12px;
  padding: 0 16px 16px;
  font-size: 0.875rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
