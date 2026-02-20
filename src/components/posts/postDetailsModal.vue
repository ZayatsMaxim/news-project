<script lang="ts">
import { usePostsStore } from '@/stores/postsStore'

export default {
  name: 'PostDetailsModal',
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    postId: {
      type: Number as () => number | null,
      default: null,
    },
  },
  emits: ['update:modelValue', 'navigate'],
  setup() {
    return { postsStore: usePostsStore() }
  },
  computed: {
    isOpen: {
      get(): boolean {
        return this.modelValue
      },
      set(value: boolean) {
        this.$emit('update:modelValue', value)
      },
    },
    post() {
      return this.postsStore.modalPost
    },
    user() {
      return this.postsStore.modalUser
    },
    authorLine(): string {
      const u = this.user
      if (!u) return ''
      const parts = [u.firstName, u.lastName].filter(Boolean).join(' ')
      return parts.trim() || '—'
    },
    currentPostIndex(): number {
      if (this.postId == null) return -1
      return this.postsStore.posts.findIndex((item) => item.id === this.postId)
    },
    prevPostId(): number | null {
      if (this.currentPostIndex <= 0) return null
      return this.postsStore.posts[this.currentPostIndex - 1]?.id ?? null
    },
    nextPostId(): number | null {
      if (this.currentPostIndex < 0) return null
      return this.postsStore.posts[this.currentPostIndex + 1]?.id ?? null
    },
  },
  watch: {
    isOpen(open: boolean) {
      if (open && this.postId != null) {
        this.postsStore.fetchPostById(this.postId)
      }
    },
    postId(newPostId: number | null) {
      if (this.isOpen && newPostId != null) {
        this.postsStore.fetchPostById(newPostId)
      }
    },
  },
  methods: {
    goToPrevPost() {
      if (this.prevPostId == null) return
      this.$emit('navigate', this.prevPostId)
    },
    goToNextPost() {
      if (this.nextPostId == null) return
      this.$emit('navigate', this.nextPostId)
    },
  },
}
</script>

<template>
  <v-dialog
    v-model="isOpen"
    persistent
    max-width="1200"
    @after-leave="postsStore.clearModalPost()"
  >
    <div class="modal-layout">
      <button
        type="button"
        class="nav-zone"
        :class="{ 'nav-zone-disabled': prevPostId == null }"
        @click.stop="goToPrevPost"
      >
        <span class="nav-arrow">&lt;</span>
      </button>

      <v-card class="modal-card">
        <v-card-title>{{ post?.title ?? (postId != null ? `Пост #${postId}` : 'Пост') }}</v-card-title>

        <template v-if="postsStore.modalPostLoading">
          <v-card-text class="loading-placeholder">Загрузка</v-card-text>
        </template>

        <template v-else-if="post">
          <v-card-text v-if="user" class="author-block">
            <div class="author-line">{{ authorLine }}</div>
            <div v-if="user.jobTitle" class="author-meta">Должность: {{ user.jobTitle }}</div>
            <div v-if="user.department" class="author-meta">Отдел: {{ user.department }}</div>
          </v-card-text>
          <v-card-text>{{ post.body }}</v-card-text>
          <v-card-text v-if="post.tags?.length" class="pt-0 tags-wrap">
            <v-chip
              v-for="tag in post.tags"
              :key="tag"
              size="small"
              variant="tonal"
            >
              {{ tag }}
            </v-chip>
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
          <v-card-text v-if="postsStore.modalComments.length" class="comments-block">
            <div class="comments-title">Комментарии</div>
            <div
              v-for="comment in postsStore.modalComments"
              :key="comment.id"
              class="comment-item"
            >
              <div class="comment-username">{{ comment.user.username }}</div>
              <div class="comment-body">{{ comment.body }}</div>
            </div>
          </v-card-text>
        </template>

        <template v-else>
          <v-card-text>Нет данных</v-card-text>
        </template>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="isOpen = false">Закрыть</v-btn>
        </v-card-actions>
      </v-card>

      <button
        type="button"
        class="nav-zone"
        :class="{ 'nav-zone-disabled': nextPostId == null }"
        @click.stop="goToNextPost"
      >
        <span class="nav-arrow">&gt;</span>
      </button>
    </div>
  </v-dialog>
</template>

<style scoped>
.modal-layout {
  width: 100%;
  max-width: 1200px;
  height: 100dvh;
  display: grid;
  grid-template-columns: minmax(48px, 1fr) minmax(0, 640px) minmax(48px, 1fr);
  align-items: center;
  margin: 0 auto;
}

.modal-card {
  max-height: 90vh;
  overflow: auto;
}

.nav-zone {
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.75);
  cursor: pointer;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-zone-disabled {
  cursor: default;
  opacity: 0.35;
}

.nav-arrow {
  font-size: 2.2rem;
  line-height: 1;
  user-select: none;
}

.author-block {
  padding-bottom: 0;
}
.author-line {
  font-weight: 600;
  margin-bottom: 4px;
}
.author-meta {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-top: 2px;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

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

.comments-block {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-top: 12px;
}
.comments-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 0.9375rem;
}
.comment-item {
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.3);
}
.comment-item:last-child {
  border-bottom: none;
}
.comment-username {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 4px;
}
.comment-body {
  font-size: 0.875rem;
}

.loading-placeholder {
  text-align: center;
  padding: 32px 16px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>
