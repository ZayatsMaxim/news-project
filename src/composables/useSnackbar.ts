import { ref } from 'vue'

const snackbarVisible = ref(false)
const snackbarMessage = ref('')
const snackbarColor = ref<string>('error')

function showSnackbar(message: string, color: string = 'error') {
  snackbarMessage.value = message
  snackbarColor.value = color
  snackbarVisible.value = true
}

function closeSnackbar() {
  snackbarVisible.value = false
}

export function useSnackbar() {
  return {
    snackbarVisible,
    snackbarMessage,
    snackbarColor,
    showSnackbar,
    closeSnackbar,
  }
}
