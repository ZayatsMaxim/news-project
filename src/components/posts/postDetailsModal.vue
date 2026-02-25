<script setup lang="ts">
import { computed, ref, watch, inject } from 'vue'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import { usePostsCoordinator } from '@/composables/usePostsCoordinator'
import { useErrorSnackbar } from '@/composables/useErrorSnackbar'
import { isAbortError } from '@/utils/error'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const postDetailsStore = usePostDetailsStore()
const coordinator = usePostsCoordinator()
const errorSnackbar = inject<ReturnType<typeof useErrorSnackbar>>('errorSnackbar')!

const isNavigating = ref(false)
const isEditing = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const post = computed(() => postDetailsStore.modalPost)
const user = computed(() => postDetailsStore.modalUser)

const authorLine = computed(() => {
  const u = user.value
  if (!u) return ''
  const parts = [u.firstName, u.lastName].filter(Boolean).join(' ')
  return parts.trim() || '—'
})

const hasPrevPost = coordinator.hasPrevPost
const hasNextPost = coordinator.hasNextPost

const showSaveButton = computed(() => isEditing.value && postDetailsStore.hasUnsavedChanges)
const showModalSkeleton = computed(() => postDetailsStore.modalPostLoading || !post.value)

watch(post, () => postDetailsStore.snapshotOriginal(), { immediate: true })

function onAfterLeave() {
  postDetailsStore.revertEdits()
  postDetailsStore.clearModalPost()
  isEditing.value = false
}

function resetEditState() {
  postDetailsStore.revertEdits()
  isEditing.value = false
}

function startEdit() {
  isEditing.value = true
}

async function saveChanges() {
  const postId = postDetailsStore.modalRequestedPostId
  if (postId == null) return
  try {
    const saved = await coordinator.saveAndSync(postId)
    if (saved) isEditing.value = false
  } catch (e) {
    if (!isAbortError(e)) errorSnackbar.showSnackbar('Ошибка сохранения изменений')
  }
}

async function goToPrevPost() {
  if (!hasPrevPost.value || isNavigating.value || isEditing.value) return
  isNavigating.value = true
  try {
    await coordinator.goToPrevPost()
  } catch (e) {
    if (!isAbortError(e)) errorSnackbar.showSnackbar('Ошибка загрузки поста')
  } finally {
    isNavigating.value = false
  }
}

async function goToNextPost() {
  if (!hasNextPost.value || isNavigating.value || isEditing.value) return
  isNavigating.value = true
  try {
    await coordinator.goToNextPost()
  } catch (e) {
    if (!isAbortError(e)) errorSnackbar.showSnackbar('Ошибка загрузки поста')
  } finally {
    isNavigating.value = false
  }
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
              {{
                postDetailsStore.modalRequestedPostId != null
                  ? `Пост #${postDetailsStore.modalRequestedPostId}`
                  : 'Пост'
              }}
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
              :variant="isEditing ? 'underlined' : 'plain'"
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
              :variant="isEditing ? 'underlined' : 'plain'"
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
              <span class="comment-likes">
                <v-icon icon="mdi-thumb-up-outline" size="16" />
                {{ comment.likes }}
              </span>
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
.comment-likes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-top: 4px;
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
