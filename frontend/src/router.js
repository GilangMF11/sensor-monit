import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./pages/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('./pages/Dashboard.vue'),
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('./pages/History.vue'),
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('./pages/Statistics.vue'),
  },
  {
    path: '/alerts',
    name: 'Alerts',
    component: () => import('./pages/Alerts.vue'),
  },
  {
    path: '/config',
    name: 'AlertConfig',
    component: () => import('./pages/AlertConfig.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const token = localStorage.getItem('auth_token')
  if (!token && to.name !== 'Login') return { name: 'Login' }
  if (token && to.meta.guest) return { name: 'Dashboard' }
})

export default router
