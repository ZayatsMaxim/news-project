<script lang="ts">
import { mapStores } from 'pinia'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import { usePostsListStore } from '@/stores/postsListStore'

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

  computed: {
    ...mapStores(usePostDetailsStore, usePostsListStore),
    isOpen: {
      get(): boolean {
        return this.modelValue
      },
      set(value: boolean) {
        this.$emit('update:modelValue', value)
      },
    },
    post() {
      return this.postDetailsStore.modalPost
    },
    user() {
      return this.postDetailsStore.modalUser
    },
    authorLine(): string {
      const u = this.user
      if (!u) return ''
      const parts = [u.firstName, u.lastName].filter(Boolean).join(' ')
      return parts.trim() || '—'
    },
    /** Страница выдачи (таблица или модалка), в которой находится текущий пост; null, если пост нигде не найден. */
    modalContext(): { postIds: number[]; skip: number } | null {
      if (this.postId == null) return null
      return this.postsListStore.postsForModal(this.postId)
    },
    currentPostIndex(): number {
      const ctx = this.modalContext
      if (!ctx || this.postId == null) return -1
      return ctx.postIds.indexOf(this.postId)
    },
    hasPrevPost(): boolean {
      const ctx = this.modalContext
      if (!ctx || this.postId == null) return false
      const index = ctx.postIds.indexOf(this.postId)
      if (index < 0) return false
      return index > 0 || ctx.skip > 0
    },
    hasNextPost(): boolean {
      const ctx = this.modalContext
      if (!ctx || this.postId == null) return false
      const index = ctx.postIds.indexOf(this.postId)
      if (index < 0) return false
      const { postIds, skip } = ctx
      const { total } = this.postsListStore
      return index < postIds.length - 1 || skip + postIds.length < total
    },
    showSaveButton(): boolean {
      return this.isEditing && this.postDetailsStore.hasUnsavedChanges
    },
    /** Показывать скелетон: идёт загрузка или открыт другой пост, чем загруженный. */
    showModalSkeleton(): boolean {
      if (this.postDetailsStore.modalPostLoading) return true
      if (this.postId == null) return false
      return !this.post || this.post.id !== this.postId
    },
  },

  data() {
    return {
      isNavigating: false,
      isEditing: false,
    }
  },

  watch: {
    isOpen(open: boolean) {
      if (open && this.postId != null) {
        this.postDetailsStore.fetchPostById(this.postId)
      }
    },
    postId(newPostId: number | null) {
      this.isEditing = false
      if (this.isOpen && newPostId != null) {
        this.postDetailsStore.fetchPostById(newPostId)
      }
    },
    post: {
      handler() {
        this.postDetailsStore.snapshotOriginal()
      },
      immediate: true,
    },
  },
  methods: {
    onAfterLeave() {
      this.postDetailsStore.revertEdits()
      this.postDetailsStore.clearModalPost()
      this.isEditing = false
    },
    resetEditState() {
      this.postDetailsStore.revertEdits()
      this.isEditing = false
    },
    startEdit() {
      this.isEditing = true
    },
    async saveChanges() {
      if (this.postId == null) return
      const saved = await this.postDetailsStore.saveChanges(this.postId)
      if (saved) this.isEditing = false
    },
    async goToPrevPost() {
      if (!this.hasPrevPost || this.isNavigating || this.postId == null) return
      this.isNavigating = true
      try {
        const id = await this.postsListStore.getPrevPostId(this.postId)
        if (id != null) this.$emit('navigate', id)
      } finally {
        this.isNavigating = false
      }
    },
    async goToNextPost() {
      if (!this.hasNextPost || this.isNavigating || this.postId == null) return
      this.isNavigating = true
      try {
        const id = await this.postsListStore.getNextPostId(this.postId)
        if (id != null) this.$emit('navigate', id)
      } finally {
        this.isNavigating = false
      }
    },
  },
}
</script>

<template>
  <v-dialog v-model="isOpen" persistent max-width="1200" @after-leave="onAfterLeave">
    <div class="modal-layout">
      <button
        type="button"
        class="nav-zone"
        :class="{ 'nav-zone-disabled': !hasPrevPost || isNavigating || isEditing }"
        :disabled="!hasPrevPost || isNavigating || isEditing"
        @click.stop="goToPrevPost"
      >
        <span class="nav-arrow">&lt;</span>
      </button>

      <v-card class="modal-card">
        <div class="modal-card-header">
          <template v-if="showModalSkeleton || !post">
            <v-card-title v-if="!showModalSkeleton" class="modal-title-text">
              {{ postId != null ? `Пост #${postId}` : 'Пост' }}
            </v-card-title>
            <v-skeleton-loader
              v-else
              type="heading"
              class="modal-title-text modal-skeleton-title"
            />
          </template>
          <template v-else>
            <v-text-field
              v-model="post.title"
              :variant="isEditing ? 'outlined' : 'plain'"
              density="compact"
              hide-details
              class="modal-title-text modal-title-edit"
              placeholder="Заголовок"
              :readonly="!isEditing"
            />
          </template>
          <div class="modal-header-actions">
            <v-btn
              v-if="post && !showModalSkeleton"
              :icon="isEditing ? 'mdi-undo' : 'mdi-pencil'"
              :color="isEditing ? 'error' : undefined"
              variant="text"
              size="small"
              :aria-label="isEditing ? 'Отменить редактирование' : 'Редактировать'"
              @click="isEditing ? resetEditState() : startEdit()"
            />
            <v-btn
              v-if="showSaveButton"
              icon="mdi-content-save"
              color="success"
              variant="text"
              size="small"
              aria-label="Сохранить"
              @click="saveChanges"
            />
          </div>
        </div>

        <template v-if="showModalSkeleton">
          <v-card-text class="modal-skeleton-body">
            <v-skeleton-loader type="list-item-two-line" class="modal-skeleton-author" />
            <v-skeleton-loader type="paragraph" class="modal-skeleton-paragraph" />
            <div class="meta modal-skeleton-meta">
              <v-skeleton-loader
                v-for="i in 3"
                :key="i"
                type="chip"
                class="modal-skeleton-meta-item"
              />
            </div>
          </v-card-text>
        </template>

        <template v-else-if="post">
          <v-card-text v-if="user" class="author-block">
            <div class="author-line">{{ authorLine }}</div>
            <div v-if="user.jobTitle" class="author-meta">Должность: {{ user.jobTitle }}</div>
            <div v-if="user.department" class="author-meta">Отдел: {{ user.department }}</div>
          </v-card-text>
          <v-card-text class="pt-0">
            <v-textarea
              v-model="post.body"
              :variant="isEditing ? 'outlined' : 'plain'"
              hide-details
              rows="6"
              class="modal-body-edit"
              placeholder="Текст новости"
              :readonly="!isEditing"
            />
          </v-card-text>
          <v-card-text v-if="post.tags?.length" class="pt-0 tags-wrap">
            <v-chip v-for="tag in post.tags" :key="tag" size="small" variant="tonal">
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
          <v-card-text v-if="postDetailsStore.modalComments.length" class="comments-block">
            <div class="comments-title">Комментарии</div>
            <div
              v-for="comment in postDetailsStore.modalComments"
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
        :class="{ 'nav-zone-disabled': !hasNextPost || isNavigating || isEditing }"
        :disabled="!hasNextPost || isNavigating || isEditing"
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

.modal-card-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 16px 16px 0;
}

.modal-title-text,
.modal-title-edit {
  flex: 1;
  min-width: 0;
}

.modal-title-text {
  padding-left: 0;
}

.modal-title-edit {
  padding-top: 0;
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.modal-body-edit {
  width: 100%;
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

.modal-skeleton-title {
  flex: 1;
  min-width: 0;
  margin-left: 0;
}

.modal-skeleton-title :deep(.v-skeleton-loader) {
  margin-left: 0;
  padding-left: 0;
}

.modal-skeleton-title :deep(.v-skeleton-loader__heading) {
  margin-left: 0 !important;
}

.modal-skeleton-body {
  padding: 16px;
  padding-left: 16px;
  margin-left: 0;
}

.modal-skeleton-body :deep(.v-skeleton-loader) {
  margin-left: 0;
  padding-left: 0;
}

.modal-skeleton-body :deep(.v-skeleton-loader__text) {
  margin-left: 0 !important;
}

.modal-skeleton-body :deep(.v-skeleton-loader__heading) {
  margin-left: 0 !important;
}

.modal-skeleton-author {
  margin-bottom: 8px;
  margin-left: 0;
}

.modal-skeleton-author :deep(.v-skeleton-loader) {
  margin-left: 0;
  padding-left: 0;
}

.modal-skeleton-paragraph {
  margin-bottom: 16px;
  margin-left: 0;
}

.modal-skeleton-paragraph :deep(.v-skeleton-loader) {
  margin-left: 0;
  padding-left: 0;
}

.modal-skeleton-meta {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  padding: 0;
  margin-left: 0;
}

.modal-skeleton-meta-item {
  flex-shrink: 0;
  width: 48px;
  max-height: 24px;
  margin: 0;
}

.modal-skeleton-meta-item :deep(.v-skeleton-loader__chip) {
  height: 24px;
  margin: 0;
}
</style>
