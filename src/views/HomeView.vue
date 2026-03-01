<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUserStore'
import { usePostDetailsStore } from '@/stores/postDetailsStore'
import { useSnackbar } from '@/composables/useSnackbar'
import { SNACKBAR_ERROR_PROFILE_LOAD_FAILED } from '@/constants/snackbarErrorMessages'

const loginUserStore = useLoginUserStore()
const postDetailsStore = usePostDetailsStore()
const { user, fullName } = storeToRefs(loginUserStore)
const router = useRouter()
const { showSnackbar } = useSnackbar()

watch(
  () => loginUserStore.user,
  (u) => {
    postDetailsStore.loadReactionsForUser(u?.id ?? null)
  },
  { immediate: true },
)

onMounted(() => {
  loginUserStore.fetchAuthorizedUser().catch(() => {
    showSnackbar(SNACKBAR_ERROR_PROFILE_LOAD_FAILED)
  })
})

function onLogout() {
  loginUserStore.clearUserCredentials()
  router.push('/login')
}
</script>

<template>
  <div class="d-flex flex-column flex-fill min-height-0 overflow-hidden" style="height: 100%">
    <v-container class="flex-shrink-0">
      <header class="d-flex align-center justify-space-between">
        <div>
          <div class="text-h4">Новости</div>
          <div class="text-subtitle-2 text-medium-emphasis">Последние новости от пользователей</div>
        </div>
        <v-menu>
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-menu"
              variant="plain"
              color="primary"
              aria-label="Меню"
            />
          </template>
          <v-card min-width="240" class="pa-3">
            <div v-if="user" class="d-flex align-center ga-4 mb-3">
              <v-avatar size="48">
                <v-img :src="user.image || undefined" />
                <v-icon v-if="!user.image">mdi-account</v-icon>
              </v-avatar>
              <div class="flex-grow-1 min-width-0">
                <div class="text-subtitle-1 font-medium text-truncate">{{ fullName }}</div>
                <div class="text-caption text-medium-emphasis text-truncate">
                  @{{ user.username }}
                </div>
              </div>
            </div>
            <v-divider class="my-2" />
            <v-btn
              block
              variant="tonal"
              color="secondary"
              prepend-icon="mdi-logout"
              @click="onLogout"
            >
              Выйти
            </v-btn>
          </v-card>
        </v-menu>
      </header>
    </v-container>
    <main class="flex-fill min-height-0 d-flex flex-column">
      <RouterView />
    </main>
  </div>
</template>
