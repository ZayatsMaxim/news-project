<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUserStore'

const username = ref('')
const password = ref('')

const loginUserStore = useLoginUserStore()
const router = useRouter()
const route = useRoute()

const login = async () => {
  try {
    await loginUserStore.login(username.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (error) {
    console.error('Не удалось авторизоваться', error)
  }
}
</script>

<template>
  <div class="login-layout">
    <v-card class="login-card" max-width="400" variant="elevated">
      <v-card-title class="text-h6">Вход</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="username"
          label="Логин"
          type="text"
          variant="outlined"
          density="compact"
          hide-details="auto"
          autocomplete="username"
        />
        <v-text-field
          v-model="password"
          label="Пароль"
          type="password"
          variant="outlined"
          density="compact"
          hide-details="auto"
          class="mt-2"
          autocomplete="current-password"
        />
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
