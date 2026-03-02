import { createRouter, createWebHashHistory } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUserStore'
import { isJwtExpired } from '@/utils/jwt'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import PostsTableView from '@/views/postsTable/PostsTableView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

const routes = [
  { path: '/login', component: LoginView },
  {
    path: '/',
    component: HomeView,
    meta: { requiresAuth: true },
    children: [{ path: '', component: PostsTableView }],
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const loginStore = useLoginUserStore()
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (!requiresAuth) {
    const token = loginStore.accessToken
    const alreadyLoggedIn = to.path === '/login' && !!token && !isJwtExpired(token)
    if (alreadyLoggedIn) {
      next({ path: '/' })
      return
    }
    next()
    return
  }

  let accessToken = loginStore.accessToken

  if (!accessToken) {
    const refreshed = await loginStore.refreshTokens()
    if (!refreshed) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }
    accessToken = loginStore.accessToken
  }

  if (accessToken && isJwtExpired(accessToken)) {
    const refreshed = await loginStore.refreshTokens()
    if (!refreshed) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }
  }

  next()
})
