<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUserStore'
import { useErrorSnackbar } from '@/composables/useErrorSnackbar'
import {
  SNACKBAR_ERROR_LOGIN_FAILED,
  SNACKBAR_ERROR_LOGIN_INVALID_CREDENTIALS,
} from '@/constants/snackbarErrorMessages'

const username = ref('')
const password = ref('')
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const loginUserStore = useLoginUserStore()
const router = useRouter()
const route = useRoute()
const { showSnackbar } = useErrorSnackbar()

function isInvalidCredentialsError(error: unknown): boolean {
  const err = error as { response?: { data?: { message?: string } } }
  return err.response?.data?.message === 'Invalid credentials'
}

const login = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false }
  if (!valid) return
  try {
    await loginUserStore.login(username.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (error) {
    const message = isInvalidCredentialsError(error)
      ? SNACKBAR_ERROR_LOGIN_INVALID_CREDENTIALS
      : SNACKBAR_ERROR_LOGIN_FAILED
    showSnackbar(message)
  }
}
</script>

<template>
  <div class="login-layout">
    <v-card class="login-card" max-width="400" variant="elevated">
      <v-card-title class="text-h6">Вход</v-card-title>
      <v-card-text>
        <v-form ref="formRef">
          <v-text-field
            v-model="username"
            label="Логин"
            type="text"
            variant="outlined"
            density="compact"
            autocomplete="username"
            :rules="[(v: string) => !!String(v ?? '').trim() || 'Введите логин']"
          />
          <v-text-field
            v-model="password"
            label="Пароль"
            type="password"
            variant="outlined"
            density="compact"
            class="mt-2"
            autocomplete="current-password"
            :rules="[(v: string) => !!String(v ?? '').trim() || 'Введите пароль']"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="elevated" @click="login">Войти</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<style scoped>
.login-layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 100%;
  padding: 1rem;
  margin-top: 100px;
}

.login-card {
  width: 100%;
}
</style>
