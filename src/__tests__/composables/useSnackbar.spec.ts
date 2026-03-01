import { describe, it, expect, beforeEach } from 'vitest'
import { useSnackbar } from '@/composables/useSnackbar'

describe('useSnackbar', () => {
  beforeEach(() => {
    const { closeSnackbar } = useSnackbar()
    closeSnackbar()
  })

  it('showSnackbar sets message and visible', () => {
    const { snackbarMessage, snackbarVisible, showSnackbar } = useSnackbar()

    expect(snackbarVisible.value).toBe(false)
    expect(snackbarMessage.value).toBe('')

    showSnackbar('Something went wrong')

    expect(snackbarMessage.value).toBe('Something went wrong')
    expect(snackbarVisible.value).toBe(true)
  })

  it('closeSnackbar sets visible to false', () => {
    const { snackbarVisible, showSnackbar, closeSnackbar } = useSnackbar()

    showSnackbar('Error')
    expect(snackbarVisible.value).toBe(true)

    closeSnackbar()
    expect(snackbarVisible.value).toBe(false)
  })

  it('returns same refs and methods for every caller (singleton)', () => {
    const a = useSnackbar()
    const b = useSnackbar()
    expect(a.snackbarVisible).toBe(b.snackbarVisible)
    expect(a.snackbarMessage).toBe(b.snackbarMessage)
    expect(a.showSnackbar).toBe(b.showSnackbar)
    expect(a.closeSnackbar).toBe(b.closeSnackbar)
  })

  it('snackbarColor defaults to error', () => {
    const { snackbarColor, showSnackbar } = useSnackbar()

    showSnackbar('Error message')

    expect(snackbarColor.value).toBe('error')
  })

  it('showSnackbar sets custom color', () => {
    const { snackbarColor, showSnackbar } = useSnackbar()

    showSnackbar('Success!', 'success')

    expect(snackbarColor.value).toBe('success')
  })

  it('snackbarColor is shared across instances', () => {
    const a = useSnackbar()
    const b = useSnackbar()
    expect(a.snackbarColor).toBe(b.snackbarColor)
  })
})
