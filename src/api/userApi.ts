import { fetchJson } from '@/api/httpClient'
import { apiConfig } from '@/config/api'
import type { UserDto } from '@/dto/user/userDto'
import { toFiniteNumber } from '@/utils/number'

const USERS_BASE_URL = apiConfig.usersBaseUrl

/** Ответ GET /users/:id (используем только часть полей) */
interface RawUser {
  id?: unknown
  username?: unknown
  firstName?: unknown
  lastName?: unknown
  company?: { title?: unknown; department?: unknown }
}

function normalizeUser(raw: RawUser): UserDto {
  const company = raw.company && typeof raw.company === 'object' ? raw.company : undefined
  const jobTitle = typeof company?.title === 'string' ? company.title : undefined
  const department = typeof company?.department === 'string' ? company.department : undefined
  return {
    id: toFiniteNumber(raw.id, 0),
    username: typeof raw.username === 'string' ? raw.username : '',
    firstName: typeof raw.firstName === 'string' ? raw.firstName : '',
    lastName: typeof raw.lastName === 'string' ? raw.lastName : '',
    ...(jobTitle ? { jobTitle } : {}),
    ...(department ? { department } : {}),
  }
}

/** Получить пользователя по id (GET /users/:userId) */
export async function getUser(userId: number, signal?: AbortSignal): Promise<UserDto> {
  const raw = await fetchJson<RawUser>(`${USERS_BASE_URL}/${userId}`, { signal })
  return normalizeUser(raw)
}
