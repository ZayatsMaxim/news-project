const baseUrl = import.meta.env.VITE_API_BASE_URL
const authUrl = import.meta.env.VITE_API_AUTH_URL

export const apiConfig = {
  baseUrl,
  postsBaseUrl: `${baseUrl}/posts`,
  commentsBaseUrl: `${baseUrl}/comments`,
  usersBaseUrl: `${authUrl}/users`,
  authBaseUrl: authUrl,
  postsSelect: 'id,title,body,userId,reactions,views',
} as const

export const REFRESH_TOKEN_KEY = 'RefreshToken'
