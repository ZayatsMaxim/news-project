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
    <div>
      <span>Понравилось: {{ post.reactions.likes }}</span>
      <span>Не понравилось: {{ post.reactions.dislikes }}</span>
      <span>Просмотров: {{ post.views }}</span>
    </div>
  </v-card>
</template>

<style scoped></style>
