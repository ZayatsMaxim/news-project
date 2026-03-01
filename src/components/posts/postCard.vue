<script setup lang="ts">
import { computed } from 'vue'
import type { PostDto } from '@/dto/post/postDto'

const props = defineProps<{ post: PostDto }>()
const emit = defineEmits<{ (e: 'open'): void }>()

const truncatedPostBody = computed(() => {
  const text = props.post.body ?? ''
  return text.length > 100 ? text.slice(0, 100) + '...' : text
})
</script>

<template>
  <v-card
    class="post-card"
    :title="post.title"
    :subtitle="`ID автора: ${post.userId}`"
    @click="emit('open')"
  >
    <v-card-text class="flex-grow-1 min-height-0">
      {{ truncatedPostBody }}
    </v-card-text>
    <div class="d-flex ga-3 px-4 pb-4 text-body-2">
      <span class="d-inline-flex align-center ga-1">
        <v-icon icon="mdi-thumb-up-outline" size="18" />
        {{ post.reactions.likes }}
      </span>
      <span class="d-inline-flex align-center ga-1">
        <v-icon icon="mdi-thumb-down-outline" size="18" />
        {{ post.reactions.dislikes }}
      </span>
      <span class="d-inline-flex align-center ga-1">
        <v-icon icon="mdi-eye-outline" size="18" />
        {{ post.views }}
      </span>
    </div>
  </v-card>
</template>

<style scoped>
.post-card {
  cursor: pointer;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.post-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.18);
}
</style>
