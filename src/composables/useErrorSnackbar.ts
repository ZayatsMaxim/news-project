import { ref } from 'vue'

export function useErrorSnackbar() {
  const snackbarVisible = ref(false)
  const snackbarMessage = ref('')

  function showSnackbar(message: string) {
    snackbarMessage.value = message
    snackbarVisible.value = true
  }

  function closeSnackbar() {
    snackbarVisible.value = false
  }

  return {
    snackbarVisible,
    snackbarMessage,
    showSnackbar,
    closeSnackbar,
  }
}
