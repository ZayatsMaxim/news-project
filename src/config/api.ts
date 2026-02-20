const baseUrl = import.meta.env.VITE_API_BASE_URL

export const apiConfig = {
  baseUrl,
  postsBaseUrl: `${baseUrl}/posts`,
  usersBaseUrl: `${baseUrl}/users`,
} as const
