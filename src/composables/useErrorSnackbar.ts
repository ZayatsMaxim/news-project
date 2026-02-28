import { ref } from 'vue'

const snackbarVisible = ref(false)
const snackbarMessage = ref('')

function showSnackbar(message: string) {
  snackbarMessage.value = message
  snackbarVisible.value = true
}

function closeSnackbar() {
  snackbarVisible.value = false
}

export function useErrorSnackbar() {
  return {
    snackbarVisible,
    snackbarMessage,
    showSnackbar,
    closeSnackbar,
  }
}
