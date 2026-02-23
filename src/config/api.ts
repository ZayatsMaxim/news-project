const baseUrl = import.meta.env.VITE_API_BASE_URL

export const apiConfig = {
  baseUrl,
  postsBaseUrl: `${baseUrl}/posts`,
  usersBaseUrl: `${baseUrl}/users`,
  postsSelect: 'id,title,body,userId,reactions,views',
} as const
