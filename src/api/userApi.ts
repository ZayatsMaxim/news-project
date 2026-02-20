import type { UserDto } from '@/dto/user/userDto'

const USERS_BASE_URL = 'https://dummyjson.com/users'

/** Ответ GET /users/:id (используем только часть полей) */
interface RawUser {
  id?: unknown
  username?: unknown
  firstName?: unknown
  lastName?: unknown
  company?: { title?: unknown; department?: unknown }
}

function toNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function normalizeUser(raw: RawUser): UserDto {
  const company = raw.company && typeof raw.company === 'object' ? raw.company : undefined
  const jobTitle = typeof company?.title === 'string' ? company.title : undefined
  const department = typeof company?.department === 'string' ? company.department : undefined
  return {
    id: toNum(raw.id, 0),
    username: typeof raw.username === 'string' ? raw.username : '',
    firstName: typeof raw.firstName === 'string' ? raw.firstName : '',
    lastName: typeof raw.lastName === 'string' ? raw.lastName : '',
    ...(jobTitle ? { jobTitle } : {}),
    ...(department ? { department } : {}),
  }
}

/** Получить пользователя по id (GET /users/:userId) */
export async function getUser(userId: number, signal?: AbortSignal): Promise<UserDto> {
  const response = await fetch(`${USERS_BASE_URL}/${userId}`, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`)
  }
  const raw = (await response.json()) as RawUser
  return normalizeUser(raw)
}
