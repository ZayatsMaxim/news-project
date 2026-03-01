<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import { usePostsCoordinator } from '@/composables/usePostsCoordinator'
import { useErrorSnackbar } from '@/composables/useErrorSnackbar'
import { isAbortError } from '@/utils/error'
import {
  SNACKBAR_ERROR_POST_LOAD_FAILED,
  SNACKBAR_ERROR_POST_SAVE_FAILED,
} from '@/constants/snackbarErrorMessages'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const postDetailsStore = usePostDetailsStore()
const coordinator = usePostsCoordinator()
const { showSnackbar } = useErrorSnackbar()

const isNavigating = ref(false)
const isEditing = ref(false)
const formRef = ref<{ validate: () => Promise<{ valid: boolean }>; resetValidation: () => void } | null>(null)

const titleRules = [(v: string) => !!String(v ?? '').trim() || 'Заголовок не должен быть пустым']
const bodyRules = [(v: string) => !!String(v ?? '').trim() || 'Текст не должен быть пустым']

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
const isFormValid = computed(() => {
  const p = post.value
  if (!p) return false
  return !!String(p.title ?? '').trim() && !!String(p.body ?? '').trim()
})
const showModalSkeleton = computed(() => postDetailsStore.modalPostLoading || !post.value)

watch(post, () => postDetailsStore.snapshotOriginal(), { immediate: true })

function onAfterLeave() {
  formRef.value?.resetValidation()
  postDetailsStore.revertEdits()
  postDetailsStore.clearModalPost()
  isEditing.value = false
}

function resetEditState() {
  formRef.value?.resetValidation()
  postDetailsStore.revertEdits()
  isEditing.value = false
}

function startEdit() {
  isEditing.value = true
}

async function saveChanges() {
  const postId = postDetailsStore.modalRequestedPostId
  if (postId == null) return
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  const p = post.value
  if (p) {
    p.title = p.title?.trim() ?? ''
    p.body = p.body?.trim() ?? ''
  }
  try {
    const saved = await coordinator.saveAndSync(postId)
    if (saved) isEditing.value = false
  } catch (e) {
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POST_SAVE_FAILED)
  }
}

async function goToPrevPost() {
  if (!hasPrevPost.value || isNavigating.value || isEditing.value) return
  isNavigating.value = true
  try {
    await coordinator.goToPrevPost()
  } catch (e) {
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POST_LOAD_FAILED)
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
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POST_LOAD_FAILED)
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
        <v-form ref="formRef">
        <div class="d-flex align-start ga-2 pa-4 pt-4">
          <template v-if="showModalSkeleton || !post">
            <v-card-title v-if="!showModalSkeleton" class="flex-grow-1 min-width-0 pl-0">
              {{
                postDetailsStore.modalRequestedPostId != null
                  ? `Пост #${postDetailsStore.modalRequestedPostId}`
                  : 'Пост'
              }}
            </v-card-title>
            <v-skeleton-loader
              v-else
              type="heading"
              class="flex-grow-1 min-width-0 modal-skeleton-title"
            />
          </template>
          <template v-else>
            <v-text-field
              v-model="post.title"
              :variant="isEditing ? 'underlined' : 'plain'"
              density="compact"
              hide-details="auto"
              :rules="titleRules"
              class="flex-grow-1 min-width-0 pt-0 modal-title-edit"
              placeholder="Заголовок"
              :readonly="!isEditing"
            />
          </template>
          <div class="d-flex align-center ga-1 flex-shrink-0">
            <v-chip
              v-if="post && !showModalSkeleton && postDetailsStore.modalPostWasEdited"
              size="small"
              variant="tonal"
              color="primary"
            >
              Отредактировано
            </v-chip>
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
              :disabled="!isFormValid"
              @click="saveChanges"
            />
          </div>
        </div>

        <template v-if="showModalSkeleton">
          <v-card-text class="modal-skeleton-body">
            <v-skeleton-loader type="list-item-two-line" class="modal-skeleton-author" />
            <v-skeleton-loader type="paragraph" class="modal-skeleton-paragraph" />
            <div class="meta modal-skeleton-meta ga-1">
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
          <v-card-text v-if="user" class="pb-0">
            <div class="font-weight-bold mb-1">{{ authorLine }}</div>
            <div v-if="user.jobTitle" class="text-body-2 text-medium-emphasis mt-1">
              Должность: {{ user.jobTitle }}
            </div>
            <div v-if="user.department" class="text-body-2 text-medium-emphasis mt-1">
              Отдел: {{ user.department }}
            </div>
          </v-card-text>
          <v-card-text class="pt-0">
            <v-textarea
              v-model="post.body"
              :variant="isEditing ? 'underlined' : 'plain'"
              hide-details="auto"
              :rules="bodyRules"
              rows="6"
              class="w-100"
              placeholder="Текст новости"
              :readonly="!isEditing"
            />
          </v-card-text>
          <v-card-text v-if="post.tags?.length" class="pt-0 d-flex flex-wrap ga-1">
            <v-chip v-for="tag in post.tags" :key="tag" size="small" variant="tonal">
              {{ tag }}
            </v-chip>
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
          <v-card-text v-if="postDetailsStore.modalComments.length" class="comments-block pt-3">
            <div class="font-weight-bold mb-2 text-body-1">Комментарии</div>
            <div class="comments-list">
              <div
                v-for="comment in postDetailsStore.modalComments"
                :key="comment.id"
                class="py-2 comment-item-border"
              >
                <div class="text-caption text-medium-emphasis mb-1">{{ comment.user.username }}</div>
                <div class="text-body-2">{{ comment.body }}</div>
                <span class="d-inline-flex align-center ga-1 text-caption text-medium-emphasis mt-1">
                  <v-icon icon="mdi-thumb-up-outline" size="16" />
                  {{ comment.likes }}
                </span>
              </div>
            </div>
          </v-card-text>
        </template>

        <template v-else>
          <v-card-text>Нет данных</v-card-text>
        </template>

        </v-form>
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

.min-width-0 {
  min-width: 0;
}

.flex-grow-1 {
  flex-grow: 1;
}

.flex-shrink-0 {
  flex-shrink: 0;
}

.modal-title-edit :deep(.v-field) {
  padding-top: 0;
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

.comments-block {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.comments-list {
  max-height: 280px;
  overflow-y: auto;
}

.comment-item-border {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.3);
}

.comment-item-border:last-child {
  border-bottom: none;
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
