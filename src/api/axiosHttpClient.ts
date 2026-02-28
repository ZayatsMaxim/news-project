import axios from 'axios'
import { apiConfig } from '@/config/api'
import { useLoginUserStore } from '@/stores/loginUserStore'

export const apiClient = axios.create({
  baseURL: apiConfig.authBaseUrl ?? '',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const loginStore = useLoginUserStore()
  const token = loginStore.accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
