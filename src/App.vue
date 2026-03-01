<script setup lang="ts">
import { useSnackbar } from '@/composables/useSnackbar'

const { snackbarVisible, snackbarMessage, snackbarColor, closeSnackbar } = useSnackbar()
</script>

<template>
  <v-app>
    <main class="d-flex flex-column overflow-hidden flex-fill min-height-0" style="height: 100vh">
      <RouterView />
    </main>
    <v-snackbar
      v-model="snackbarVisible"
      :text="snackbarMessage"
      :color="snackbarColor"
      location="bottom"
      @update:model-value="(v: boolean) => !v && closeSnackbar()"
    >
      <template #actions>
        <v-btn variant="text" @click="closeSnackbar">Закрыть</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style>
/* Общие утилиты для flex-верстки (Vuetify не даёт min-height: 0 / min-width: 0). Используются в App, HomeView, PostsTableView, postCard, postDetailsModal. */
.min-height-0 {
  min-height: 0;
}

.min-width-0 {
  min-width: 0;
}
</style>
