<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import { usePostsCoordinator } from '@/composables/usePostsCoordinator'
import { useSnackbar } from '@/composables/useSnackbar'
import { isAbortError } from '@/utils/error'
import {
  SNACKBAR_ERROR_POST_LOAD_FAILED,
  SNACKBAR_ERROR_POST_SAVE_FAILED,
  SNACKBAR_ERROR_POST_CREATE_FAILED,
  SNACKBAR_ERROR_POST_DELETE_FAILED,
  SNACKBAR_SUCCESS_POST_SAVED,
  SNACKBAR_SUCCESS_POST_CREATED,
  SNACKBAR_SUCCESS_POST_DELETED,
} from '@/constants/snackbarErrorMessages'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const postDetailsStore = usePostDetailsStore()
const coordinator = usePostsCoordinator()
const { showSnackbar } = useSnackbar()

const isNavigating = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const deleteConfirmOpen = ref(false)
const formRef = ref<{
  validate: () => Promise<{ valid: boolean }>
  resetValidation: () => void
} | null>(null)

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

const isModalNewPost = computed(() => postDetailsStore.isModalNewPost)

const showSaveButton = computed(
  () =>
    isEditing.value &&
    (isModalNewPost.value ? isFormValid.value : postDetailsStore.hasUnsavedChanges),
)
const isFormValid = computed(() => {
  const p = post.value
  if (!p) return false
  return !!String(p.title ?? '').trim() && !!String(p.body ?? '').trim()
})
const showModalSkeleton = computed(() => postDetailsStore.modalPostLoading || !post.value)
const userReaction = computed(() => postDetailsStore.modalPostUserReaction)

const tagsModel = computed({
  get: () => (post.value?.tags ? [...post.value.tags] : []),
  set: (v: string[]) => {
    if (post.value) post.value.tags = Array.isArray(v) ? v : []
  },
})
const tagSearch = ref('')

function addTagFromSearch() {
  const t = String(tagSearch.value ?? '').trim()
  if (!t || !post.value) return
  const tags = post.value.tags ?? []
  if (tags.includes(t)) return
  post.value.tags = [...tags, t]
  tagSearch.value = ''
}

function onToggleReaction(reaction: 'like' | 'dislike') {
  const postId = postDetailsStore.modalRequestedPostId
  if (postId != null) {
    postDetailsStore.toggleReaction(postId, reaction)
  }
}

watch(
  () => [isOpen.value, isModalNewPost.value] as const,
  ([open, isNew]) => {
    if (open && isNew) isEditing.value = true
  },
  { immediate: true },
)
watch(
  () => postDetailsStore.isModalNewPost,
  (isNew, wasNew) => {
    if (wasNew === true && !isNew) isEditing.value = false
  },
)
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
  const { valid } = (await formRef.value?.validate()) ?? { valid: false }
  if (!valid) return
  const p = post.value
  if (p) {
    p.title = p.title?.trim() ?? ''
    p.body = p.body?.trim() ?? ''
  }

  if (isModalNewPost.value) {
    isSaving.value = true
    try {
      const created = await coordinator.createModalPost()
      if (created != null) {
        isOpen.value = false
        showSnackbar(SNACKBAR_SUCCESS_POST_CREATED, 'success')
      } else {
        showSnackbar(SNACKBAR_ERROR_POST_CREATE_FAILED)
      }
    } catch (e) {
      if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POST_CREATE_FAILED)
    } finally {
      isSaving.value = false
    }
    return
  }

  const postId = postDetailsStore.modalRequestedPostId
  if (postId == null) return
  isSaving.value = true
  try {
    const saved = await coordinator.saveAndSync(postId)
    if (saved) {
      isEditing.value = false
      showSnackbar(SNACKBAR_SUCCESS_POST_SAVED, 'success')
    }
  } catch (e) {
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POST_SAVE_FAILED)
  } finally {
    isSaving.value = false
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

async function confirmDelete() {
  const postId = postDetailsStore.modalRequestedPostId
  if (postId == null) return
  deleteConfirmOpen.value = false
  isOpen.value = false
  try {
    await coordinator.deletePost(postId)
    showSnackbar(SNACKBAR_SUCCESS_POST_DELETED, 'success')
  } catch (e) {
    if (!isAbortError(e)) showSnackbar(SNACKBAR_ERROR_POST_DELETE_FAILED)
  }
}
</script>

<template>
  <v-dialog v-model="isOpen" persistent max-width="1200" @after-leave="onAfterLeave">
    <div class="modal-layout">
      <v-btn
        type="button"
        icon="mdi-chevron-left"
        variant="text"
        class="nav-btn align-self-center"
        :class="{ 'nav-btn-disabled': !hasPrevPost || isNavigating || isEditing }"
        :disabled="!hasPrevPost || isNavigating || isEditing"
        aria-label="Предыдущий пост"
        :ripple="false"
        @click.stop="goToPrevPost"
      />

      <v-card class="modal-card">
        <v-form ref="formRef">
          <div class="d-flex align-start ga-2 pa-4 pt-4">
            <template v-if="showModalSkeleton || !post">
              <v-card-title v-if="!showModalSkeleton" class="flex-grow-1 min-width-0 pl-0">
                {{
                  isModalNewPost
                    ? 'Новый пост'
                    : postDetailsStore.modalRequestedPostId != null
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
                v-if="post && !showModalSkeleton && !isModalNewPost"
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
                :disabled="!isFormValid || isSaving"
                :loading="isSaving"
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
            <v-card-text class="pt-0">
              <v-autocomplete
                v-model="tagsModel"
                multiple
                chips
                closable-chips
                variant="plain"
                density="compact"
                hide-details="auto"
                hide-options
                hide-no-data
                hide-spin-buttons
                :menu-props="{ maxHeight: 0 }"
                :disabled="!isModalNewPost && !isEditing"
                :placeholder="
                  isModalNewPost || isEditing ? 'Введите тег и нажмите Enter' : undefined
                "
                class="tags-input"
                @update:search="(v: string) => (tagSearch = v ?? '')"
                @keydown.enter.prevent="addTagFromSearch()"
              />
            </v-card-text>
            <div class="d-flex align-center ga-3 px-4 text-body-2">
              <span class="d-inline-flex align-center ga-1">
                <v-btn
                  :icon="userReaction === 'like' ? 'mdi-thumb-up' : 'mdi-thumb-up-outline'"
                  size="x-small"
                  variant="text"
                  :color="userReaction === 'like' ? 'success' : undefined"
                  :disabled="isEditing || isModalNewPost"
                  @click="onToggleReaction('like')"
                />
                {{ post.reactions.likes }}
              </span>
              <span class="d-inline-flex align-center ga-1">
                <v-btn
                  :icon="userReaction === 'dislike' ? 'mdi-thumb-down' : 'mdi-thumb-down-outline'"
                  size="x-small"
                  variant="text"
                  :color="userReaction === 'dislike' ? 'error' : undefined"
                  :disabled="isEditing || isModalNewPost"
                  @click="onToggleReaction('dislike')"
                />
                {{ post.reactions.dislikes }}
              </span>
              <span class="d-inline-flex align-center ga-1">
                <v-icon icon="mdi-eye-outline" size="18" />
                {{ post.views }}
              </span>
            </div>
            <v-card-text v-if="postDetailsStore.modalComments.length">
              <v-divider class="mb-3" />
              <div class="text-subtitle-1 font-weight-bold mb-2">Комментарии</div>
              <div class="comments-list overflow-y-auto">
                <div v-for="(comment, idx) in postDetailsStore.modalComments" :key="comment.id">
                  <v-divider v-if="idx > 0" class="my-2" />
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ comment.user.username }}
                  </div>
                  <div class="text-body-2">{{ comment.body }}</div>
                  <span class="d-inline-flex align-center ga-1 text-caption mt-1">
                    <v-btn
                      :icon="
                        postDetailsStore.isCommentLiked(comment.id)
                          ? 'mdi-thumb-up'
                          : 'mdi-thumb-up-outline'
                      "
                      size="x-small"
                      variant="text"
                      :color="postDetailsStore.isCommentLiked(comment.id) ? 'success' : undefined"
                      density="compact"
                      @click="postDetailsStore.toggleCommentLike(comment.id)"
                    />
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
          <v-menu
            v-if="post && !showModalSkeleton && !isModalNewPost"
            v-model="deleteConfirmOpen"
            :close-on-content-click="false"
            location="top"
          >
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon="mdi-delete"
                color="error"
                variant="text"
                :disabled="isEditing"
                aria-label="Удалить пост"
              />
            </template>
            <v-card min-width="200">
              <v-card-text class="text-body-2 py-2">Удалить пост?</v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn variant="text" size="small" @click="deleteConfirmOpen = false">Нет</v-btn>
                <v-btn variant="text" size="small" color="red" @click="confirmDelete"> Да </v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
          <v-spacer />
          <v-btn variant="text" @click="isOpen = false">Закрыть</v-btn>
        </v-card-actions>
      </v-card>

      <v-btn
        type="button"
        icon="mdi-chevron-right"
        variant="text"
        class="nav-btn align-self-center"
        :class="{ 'nav-btn-disabled': !hasNextPost || isNavigating || isEditing }"
        :disabled="!hasNextPost || isNavigating || isEditing"
        aria-label="Следующий пост"
        :ripple="false"
        @click.stop="goToNextPost"
      />
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

.nav-btn {
  height: 100%;
  width: 100%;
  min-width: 48px;
}

.nav-btn :deep(.v-btn__overlay),
.nav-btn :deep(.v-ripple__container) {
  display: none !important;
}

.nav-btn:hover,
.nav-btn:focus-visible {
  box-shadow: none;
}

.nav-btn :deep(.v-icon) {
  font-size: 2.5rem;
}

.nav-btn-disabled {
  opacity: 0.35;
}

.comments-list {
  max-height: 280px;
}

.modal-title-edit :deep(.v-field) {
  padding-top: 0;
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
