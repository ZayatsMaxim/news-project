import { describe, it, expect } from 'vitest'
import { toFiniteNumber } from '@/utils/number'

describe('toFiniteNumber', () => {
  it('returns value when it is a finite number', () => {
    expect(toFiniteNumber(42, 0)).toBe(42)
  })

  it('returns 0 when value is 0', () => {
    expect(toFiniteNumber(0, 99)).toBe(0)
  })

  it('returns negative number as-is', () => {
    expect(toFiniteNumber(-5, 0)).toBe(-5)
  })

  it('returns float as-is', () => {
    expect(toFiniteNumber(3.14, 0)).toBe(3.14)
  })

  it('returns fallback for NaN', () => {
    expect(toFiniteNumber(NaN, 7)).toBe(7)
  })

  it('returns fallback for Infinity', () => {
    expect(toFiniteNumber(Infinity, 10)).toBe(10)
  })

  it('returns fallback for -Infinity', () => {
    expect(toFiniteNumber(-Infinity, 10)).toBe(10)
  })

  it('returns fallback for string', () => {
    expect(toFiniteNumber('42', 0)).toBe(0)
  })

  it('returns fallback for null', () => {
    expect(toFiniteNumber(null, 5)).toBe(5)
  })

  it('returns fallback for undefined', () => {
    expect(toFiniteNumber(undefined, 5)).toBe(5)
  })

  it('returns fallback for boolean true', () => {
    expect(toFiniteNumber(true, 0)).toBe(0)
  })

  it('returns fallback for object', () => {
    expect(toFiniteNumber({}, 0)).toBe(0)
  })

  it('returns fallback for array', () => {
    expect(toFiniteNumber([1], 0)).toBe(0)
  })
})
