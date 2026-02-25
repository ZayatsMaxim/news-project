import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUser } from '@/api/userApi'

/** Expected path contract so tests fail if production config drifts. */
const USERS_PATH = '/users'

vi.mock('@/api/httpClient', () => ({
  fetchJson: vi.fn(),
}))

import { fetchJson } from '@/api/httpClient'
const mockedFetchJson = vi.mocked(fetchJson)

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRawUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    company: { title: 'Engineer', department: 'IT' },
    ...overrides,
  }
}

describe('getUser', () => {
  it('fetches user by id and normalizes result', async () => {
    mockedFetchJson.mockResolvedValue(makeRawUser({ id: 5 }))

    const result = await getUser(5)

    expect(mockedFetchJson).toHaveBeenCalledWith(expect.stringContaining(`${USERS_PATH}/5`), { signal: undefined })
    expect(result).toEqual({
      id: 5,
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      jobTitle: 'Engineer',
      department: 'IT',
    })
  })

  it('passes signal to fetchJson', async () => {
    mockedFetchJson.mockResolvedValue(makeRawUser())
    const controller = new AbortController()

    await getUser(1, controller.signal)

    expect(mockedFetchJson).toHaveBeenCalledWith(expect.stringContaining(`${USERS_PATH}/1`), {
      signal: controller.signal,
    })
  })

  it('returns defaults for missing string fields', async () => {
    mockedFetchJson.mockResolvedValue({ id: 2 })

    const result = await getUser(2)

    expect(result.username).toBe('')
    expect(result.firstName).toBe('')
    expect(result.lastName).toBe('')
  })

  it('returns fallback id=0 for missing id', async () => {
    mockedFetchJson.mockResolvedValue({})

    const result = await getUser(99)

    expect(result.id).toBe(0)
  })

  it('omits jobTitle and department when company is absent', async () => {
    mockedFetchJson.mockResolvedValue(makeRawUser({ company: undefined }))

    const result = await getUser(1)

    expect(result).not.toHaveProperty('jobTitle')
    expect(result).not.toHaveProperty('department')
  })

  it('omits jobTitle when company.title is not a string', async () => {
    mockedFetchJson.mockResolvedValue(
      makeRawUser({ company: { title: 123, department: 'Sales' } }),
    )

    const result = await getUser(1)

    expect(result).not.toHaveProperty('jobTitle')
    expect(result.department).toBe('Sales')
  })

  it('omits department when company.department is not a string', async () => {
    mockedFetchJson.mockResolvedValue(
      makeRawUser({ company: { title: 'Dev', department: null } }),
    )

    const result = await getUser(1)

    expect(result.jobTitle).toBe('Dev')
    expect(result).not.toHaveProperty('department')
  })

  it('handles company being a non-object gracefully', async () => {
    mockedFetchJson.mockResolvedValue(makeRawUser({ company: 'not-an-object' }))

    const result = await getUser(1)

    expect(result).not.toHaveProperty('jobTitle')
    expect(result).not.toHaveProperty('department')
  })

  it('handles non-finite id with fallback', async () => {
    mockedFetchJson.mockResolvedValue(makeRawUser({ id: 'abc' }))

    const result = await getUser(1)

    expect(result.id).toBe(0)
  })
})
