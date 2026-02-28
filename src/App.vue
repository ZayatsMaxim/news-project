<script setup lang="ts">
import { useErrorSnackbar } from '@/composables/useErrorSnackbar'

const { snackbarVisible, snackbarMessage, closeSnackbar } = useErrorSnackbar()
</script>

<template>
  <main class="d-flex flex-column overflow-hidden flex-fill min-height-0" style="height: 100vh">
    <RouterView />
    <v-snackbar
      v-model="snackbarVisible"
      :text="snackbarMessage"
      color="error"
      location="bottom"
      @update:model-value="(v: boolean) => !v && closeSnackbar()"
    >
      <template #actions>
        <v-btn variant="text" @click="closeSnackbar">Закрыть</v-btn>
      </template>
    </v-snackbar>
  </main>
</template>

<style scoped>
.min-height-0 {
  min-height: 0;
}

.flex-fill {
  flex: 1 1 auto;
}

.flex-shrink-0 {
  flex-shrink: 0;
}
</style>
