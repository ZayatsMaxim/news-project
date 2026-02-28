import { describe, it, expect, beforeEach } from 'vitest'
import { useErrorSnackbar } from '@/composables/useErrorSnackbar'

describe('useErrorSnackbar', () => {
  beforeEach(() => {
    const { closeSnackbar } = useErrorSnackbar()
    closeSnackbar()
  })

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

  it('returns same refs and methods for every caller (singleton)', () => {
    const a = useErrorSnackbar()
    const b = useErrorSnackbar()
    expect(a.snackbarVisible).toBe(b.snackbarVisible)
    expect(a.snackbarMessage).toBe(b.snackbarMessage)
    expect(a.showSnackbar).toBe(b.showSnackbar)
    expect(a.closeSnackbar).toBe(b.closeSnackbar)
  })
})
