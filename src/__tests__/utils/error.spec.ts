import { describe, it, expect } from 'vitest'
import { isAbortError } from '@/utils/error'

describe('isAbortError', () => {
  it('returns true for AbortError DOMException', () => {
    const error = new DOMException('The operation was aborted.', 'AbortError')
    expect(isAbortError(error)).toBe(true)
  })

  it('returns false for DOMException with different name', () => {
    const error = new DOMException('Something else', 'NotFoundError')
    expect(isAbortError(error)).toBe(false)
  })

  it('returns false for regular Error', () => {
    expect(isAbortError(new Error('fail'))).toBe(false)
  })

  it('returns false for TypeError', () => {
    expect(isAbortError(new TypeError('type error'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isAbortError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isAbortError(undefined)).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isAbortError('AbortError')).toBe(false)
  })

  it('returns false for a plain object with name AbortError', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(false)
  })
})
