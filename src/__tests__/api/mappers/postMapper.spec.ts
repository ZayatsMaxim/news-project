import { describe, it, expect } from 'vitest'
import { normalizePost, normalizePostList } from '@/api/mappers/postMapper'

const validRaw = {
  id: 1,
  title: 'Hello',
  body: 'World',
  userId: 10,
  views: 500,
  reactions: { likes: 3, dislikes: 1 },
}

describe('normalizePost', () => {
  it('normalizes a complete raw post', () => {
    const result = normalizePost(validRaw)

    expect(result).toEqual({
      id: 1,
      title: 'Hello',
      body: 'World',
      userId: 10,
      views: 500,
      reactions: { likes: 3, dislikes: 1 },
    })
  })

  it('does not include tags when absent', () => {
    const result = normalizePost(validRaw)

    expect(result).not.toHaveProperty('tags')
  })

  it('includes tags when present as string array', () => {
    const result = normalizePost({ ...validRaw, tags: ['vue', 'ts'] })

    expect(result.tags).toEqual(['vue', 'ts'])
  })

  it('filters out non-string values from tags', () => {
    const result = normalizePost({ ...validRaw, tags: ['ok', 42, null, 'fine', true] })

    expect(result.tags).toEqual(['ok', 'fine'])
  })

  it('does not include tags when array is empty', () => {
    const result = normalizePost({ ...validRaw, tags: [] })

    expect(result).not.toHaveProperty('tags')
  })

  it('does not include tags when all elements are non-string', () => {
    const result = normalizePost({ ...validRaw, tags: [1, 2, null] })

    expect(result).not.toHaveProperty('tags')
  })

  it('ignores tags when not an array', () => {
    const result = normalizePost({ ...validRaw, tags: 'not-array' })

    expect(result).not.toHaveProperty('tags')
  })

  // --- defaults for missing/invalid fields ---

  it('defaults id to 0 when missing', () => {
    const result = normalizePost({ ...validRaw, id: undefined })
    expect(result.id).toBe(0)
  })

  it('defaults id to 0 when non-numeric', () => {
    const result = normalizePost({ ...validRaw, id: 'bad' })
    expect(result.id).toBe(0)
  })

  it('defaults title to empty string when missing', () => {
    const result = normalizePost({ ...validRaw, title: undefined })
    expect(result.title).toBe('')
  })

  it('defaults title to empty string when non-string', () => {
    const result = normalizePost({ ...validRaw, title: 123 })
    expect(result.title).toBe('')
  })

  it('defaults body to empty string when missing', () => {
    const result = normalizePost({ ...validRaw, body: undefined })
    expect(result.body).toBe('')
  })

  it('defaults body to empty string when non-string', () => {
    const result = normalizePost({ ...validRaw, body: false })
    expect(result.body).toBe('')
  })

  it('defaults userId to 0 when missing', () => {
    const result = normalizePost({ ...validRaw, userId: undefined })
    expect(result.userId).toBe(0)
  })

  it('defaults views to 0 when non-finite', () => {
    const result = normalizePost({ ...validRaw, views: Infinity })
    expect(result.views).toBe(0)
  })

  // --- reactions ---

  it('defaults reactions.likes to 0 when missing', () => {
    const result = normalizePost({ ...validRaw, reactions: { dislikes: 2 } })
    expect(result.reactions.likes).toBe(0)
  })

  it('defaults reactions.dislikes to 0 when missing', () => {
    const result = normalizePost({ ...validRaw, reactions: { likes: 5 } })
    expect(result.reactions.dislikes).toBe(0)
  })

  it('defaults both reactions to 0 when reactions is undefined', () => {
    const result = normalizePost({ ...validRaw, reactions: undefined })
    expect(result.reactions).toEqual({ likes: 0, dislikes: 0 })
  })

  it('defaults reactions to 0 when values are non-numeric', () => {
    const result = normalizePost({ ...validRaw, reactions: { likes: 'many', dislikes: null } })
    expect(result.reactions).toEqual({ likes: 0, dislikes: 0 })
  })

  // --- edge cases for raw input ---

  it('returns defaults when raw is null', () => {
    const result = normalizePost(null)
    expect(result).toEqual({
      id: 0,
      title: '',
      body: '',
      userId: 0,
      views: 0,
      reactions: { likes: 0, dislikes: 0 },
    })
  })

  it('returns defaults when raw is undefined', () => {
    const result = normalizePost(undefined)
    expect(result).toEqual({
      id: 0,
      title: '',
      body: '',
      userId: 0,
      views: 0,
      reactions: { likes: 0, dislikes: 0 },
    })
  })

  it('returns defaults when raw is a number', () => {
    const result = normalizePost(42)
    expect(result.id).toBe(0)
    expect(result.title).toBe('')
  })

  it('returns defaults when raw is a string', () => {
    const result = normalizePost('hello')
    expect(result.id).toBe(0)
  })

  it('returns defaults when raw is an empty object', () => {
    const result = normalizePost({})
    expect(result).toEqual({
      id: 0,
      title: '',
      body: '',
      userId: 0,
      views: 0,
      reactions: { likes: 0, dislikes: 0 },
    })
  })
})

describe('normalizePostList', () => {
  it('normalizes an array of raw posts', () => {
    const result = normalizePostList([
      { ...validRaw, id: 1, title: 'First' },
      { ...validRaw, id: 2, title: 'Second' },
    ])

    expect(result).toHaveLength(2)
    expect(result[0]!.id).toBe(1)
    expect(result[0]!.title).toBe('First')
    expect(result[1]!.id).toBe(2)
    expect(result[1]!.title).toBe('Second')
  })

  it('returns empty array for empty input', () => {
    expect(normalizePostList([])).toEqual([])
  })

  it('handles mixed valid and invalid entries', () => {
    const result = normalizePostList([validRaw, null, 'bad', {}])

    expect(result).toHaveLength(4)
    expect(result[0]!.id).toBe(1)
    expect(result[1]!.id).toBe(0)
    expect(result[2]!.id).toBe(0)
    expect(result[3]!.id).toBe(0)
  })
})
