import { apiClient } from './axiosHttpClient'
import { apiConfig } from '@/config/api'
import type { RefreshResponseDto } from '@/dto/auth/refreshResponseDto'
import type { UserDto } from '@/dto/user/userDto'
import {
  type RawUser,
  type RawUserLogin,
  mapUserLoginToDto,
  mapUserToDto,
} from './mappers/userMapper'
import type { UserLoginDto } from '@/dto/user/userLoginDto'

const USERS_BASE_URL = apiConfig.usersBaseUrl
const AUTH_BASE_URL = apiConfig.authBaseUrl

/** Получить пользователя по id (GET /users/:userId) */
export async function getUser(userId: number, signal?: AbortSignal): Promise<UserDto> {
  const raw = await apiClient.get<RawUser>(`${USERS_BASE_URL}/${userId}`, {
    signal,
    params: { select: 'firstName,lastName,company' },
  })
  return mapUserToDto(raw.data)
}

/** Авторизация пользователя (POST /users/:userId/login) */
export async function login(username: string, password: string): Promise<UserLoginDto> {
  const raw = await apiClient.post<RawUserLogin>(`${AUTH_BASE_URL}/login`, {
    username: username,
    password: password,
  })
  return mapUserLoginToDto(raw.data)
}

/**
 * Обновление сессии по refresh token (POST /auth/refresh).
 * Вызывается без Authorization — через fetch, чтобы не зависеть от interceptor.
 */
export async function refreshAuth(refreshToken: string): Promise<RefreshResponseDto> {
  const response = await fetch(`${AUTH_BASE_URL}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, expiresInMins: 30 }),
  })

  return (await response.json()) as RefreshResponseDto
}

export async function getAuthUser(): Promise<UserLoginDto> {
  const response = await apiClient.get<RawUserLogin>(`${AUTH_BASE_URL}/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return mapUserLoginToDto(response.data)
}
