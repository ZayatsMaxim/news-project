import { describe, it, expect } from 'vitest'
import { useErrorSnackbar } from '@/composables/useErrorSnackbar'

describe('useErrorSnackbar', () => {
  it('showSnackbar sets message and visible', () => {
    const { snackbarMessage, snackbarVisible, showSnackbar } = useErrorSnackbar()

    expect(snackbarVisible.value).toBe(false)
    expect(snackbarMessage.value).toBe('')

    showSnackbar('Something went wrong')

    expect(snackbarMessage.value).toBe('Something went wrong')
    expect(snackbarVisible.value).toBe(true)
  })

  it('closeSnackbar sets visible to false', () => {
    const { snackbarVisible, showSnackbar, closeSnackbar } = useErrorSnackbar()

    showSnackbar('Error')
    expect(snackbarVisible.value).toBe(true)

    closeSnackbar()
    expect(snackbarVisible.value).toBe(false)
  })
})
