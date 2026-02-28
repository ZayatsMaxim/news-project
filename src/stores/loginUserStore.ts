import { getAuthUser, login, refreshAuth } from '@/api/userApi'
import type { UserLoginDto } from '@/dto/user/userLoginDto'
import { defineStore } from 'pinia'

const REFRESH_TOKEN_KEY = 'RefreshToken'

function makeUserWithTokens(accessToken: string, refreshToken: string): UserLoginDto {
  return {
    id: 0,
    username: '',
    firstName: '',
    lastName: '',
    gender: '',
    image: '',
    accessToken,
    refreshToken,
  }
}

export const useLoginUserStore = defineStore('loginUser', {
  state: () => ({
    user: undefined as UserLoginDto | undefined,
  }),
  getters: {
    accessToken: (state) => state.user?.accessToken ?? null,
    fullName: (state) => {
      const u = state.user
      if (!u) return ''
      const { firstName, lastName, username } = u
      return [firstName, lastName].filter(Boolean).join(' ') || username
    },
  },
  actions: {
    async login(username: string, password: string) {
      const user = await login(username, password)
      this.user = user
      localStorage.setItem(REFRESH_TOKEN_KEY, user.refreshToken)
    },

    async refreshTokens(): Promise<boolean> {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (!refreshToken) return false
      try {
        const { accessToken, refreshToken: newRefreshToken } = await refreshAuth(refreshToken)
        this.user = this.user
          ? { ...this.user, accessToken, refreshToken: newRefreshToken }
          : makeUserWithTokens(accessToken, newRefreshToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)
        return true
      } catch {
        return false
      }
    },

    clearUserCredentials() {
      this.user = undefined
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    },

    async fetchAuthorizedUser() {
      const authUser = await getAuthUser()
      this.user = {
        ...authUser,
        refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) ?? '',
        accessToken: this.user!.accessToken,
      }
    },
  },
})
