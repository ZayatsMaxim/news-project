import { describe, it, expect } from 'vitest'
import { isAbortError, getHttpStatus, isNotFoundError } from '@/utils/error'

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

describe('getHttpStatus', () => {
  it('returns status when error has numeric status property', () => {
    const err = new Error('fail') as Error & { status?: number }
    err.status = 404
    expect(getHttpStatus(err)).toBe(404)
  })

  it('returns undefined for Error without status', () => {
    expect(getHttpStatus(new Error('fail'))).toBeUndefined()
  })

  it('returns undefined for plain object without status', () => {
    expect(getHttpStatus({ message: 'x' })).toBeUndefined()
  })

  it('returns undefined for object with non-numeric status', () => {
    expect(getHttpStatus({ status: '404' })).toBeUndefined()
    expect(getHttpStatus({ status: NaN })).toBeUndefined()
  })

  it('returns undefined for null and undefined', () => {
    expect(getHttpStatus(null)).toBeUndefined()
    expect(getHttpStatus(undefined)).toBeUndefined()
  })
})

describe('isNotFoundError', () => {
  it('returns true when getHttpStatus(e) === 404', () => {
    const err = new Error('fail') as Error & { status?: number }
    err.status = 404
    expect(isNotFoundError(err)).toBe(true)
  })

  it('returns false for Error without status', () => {
    expect(isNotFoundError(new Error('fail'))).toBe(false)
  })

  it('returns false for status 500', () => {
    const err = new Error('fail') as Error & { status?: number }
    err.status = 500
    expect(isNotFoundError(err)).toBe(false)
  })
})
