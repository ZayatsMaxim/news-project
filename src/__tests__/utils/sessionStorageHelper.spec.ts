import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSessionStorageHelper, validateNumberArray } from '@/utils/sessionStorageHelper'

const mockStorage: Record<string, string> = {}
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key]
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  }),
  get length() {
    return Object.keys(mockStorage).length
  },
  key: vi.fn(() => null),
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true })
})

describe('createSessionStorageHelper', () => {
  describe('load', () => {
    it('returns fallback when key is missing', () => {
      const helper = createSessionStorageHelper('test_key', [], validateNumberArray)
      expect(helper.load()).toEqual([])
    })

    it('returns validated value when key exists', () => {
      mockStorage['test_key'] = '[1, 2, 3]'
      const helper = createSessionStorageHelper('test_key', [], validateNumberArray)
      expect(helper.load()).toEqual([1, 2, 3])
    })

    it('returns fallback on invalid JSON', () => {
      mockStorage['test_key'] = 'not json'
      const helper = createSessionStorageHelper('test_key', [], validateNumberArray)
      expect(helper.load()).toEqual([])
    })

    it('returns fallback when getItem throws', () => {
      const originalGetItem = sessionStorageMock.getItem
      sessionStorageMock.getItem = vi.fn(() => {
        throw new Error('Storage unavailable')
      })
      const helper = createSessionStorageHelper('test_key', 'default', (v) => String(v))
      expect(helper.load()).toBe('default')
      sessionStorageMock.getItem = originalGetItem
    })

    it('passes parsed value to validate function', () => {
      mockStorage['test_key'] = '{"a": 1}'
      const validate = vi.fn((parsed) => parsed)
      const helper = createSessionStorageHelper('test_key', null, validate)
      helper.load()
      expect(validate).toHaveBeenCalledWith({ a: 1 })
    })
  })

  describe('save', () => {
    it('serializes and stores value', () => {
      const helper = createSessionStorageHelper('test_key', [], validateNumberArray)
      helper.save([1, 2, 3])
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('test_key', '[1,2,3]')
    })

    it('does not throw when setItem fails', () => {
      const originalSetItem = sessionStorageMock.setItem
      sessionStorageMock.setItem = vi.fn(() => {
        throw new Error('Quota exceeded')
      })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const helper = createSessionStorageHelper('test_key', [], validateNumberArray)

      expect(() => helper.save([1])).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save "test_key" to sessionStorage',
        expect.any(Error),
      )
      consoleSpy.mockRestore()
      sessionStorageMock.setItem = originalSetItem
    })

    it('saves object values', () => {
      const helper = createSessionStorageHelper('obj_key', {}, (v) => v as Record<string, string>)
      helper.save({ a: 'like', b: 'dislike' })
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'obj_key',
        '{"a":"like","b":"dislike"}',
      )
    })
  })
})

describe('validateNumberArray', () => {
  it('returns numbers from array', () => {
    expect(validateNumberArray([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('filters out non-number elements', () => {
    expect(validateNumberArray([1, 'two', 3, null, true])).toEqual([1, 3])
  })

  it('returns empty array for non-array', () => {
    expect(validateNumberArray('not array')).toEqual([])
    expect(validateNumberArray(null)).toEqual([])
    expect(validateNumberArray(123)).toEqual([])
    expect(validateNumberArray({ a: 1 })).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(validateNumberArray([])).toEqual([])
  })
})
