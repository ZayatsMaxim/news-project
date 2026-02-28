import type { UserDto } from '@/dto/user/userDto'
import type { UserLoginDto } from '@/dto/user/userLoginDto'
import { toFiniteNumber } from '@/utils/number'

/** Ответ GET /users/:id (используем только часть полей) */
export interface RawUser {
  id?: number
  username?: string
  firstName?: string
  lastName?: string
  company?: { title?: string; department?: string }
}

export interface RawUserLogin {
  id?: number
  username?: string
  firstName?: string
  lastName?: string
  gender?: string
  image?: string
  accessToken?: string
  refreshToken?: string
}

export function mapUserToDto(raw: RawUser): UserDto {
  return {
    id: toFiniteNumber(raw.id, 0),
    username: raw.username ?? '',
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    jobTitle: raw.company?.title ?? '',
    department: raw.company?.department ?? '',
  }
}

export function mapUserLoginToDto(raw: RawUserLogin): UserLoginDto {
  return {
    id: toFiniteNumber(raw.id, 0),
    username: raw.username ?? '',
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    gender: raw.gender ?? 'other',
    image: raw.image ?? '',
    accessToken: raw.accessToken ?? '',
    refreshToken: raw.refreshToken ?? '',
  }
}
