import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import TenantsView from '../views/TenantsView.vue'
import PlansView from '../views/PlansView.vue'
import BillingView from '../views/BillingView.vue'
import SettingsView from '../views/SettingsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/tenants', name: 'tenants', component: TenantsView },
    { path: '/plans', name: 'plans', component: PlansView },
    { path: '/billing', name: 'billing', component: BillingView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/', redirect: '/dashboard' },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('sa_token')
  const isPublic = to.meta.public === true

  if (!isPublic && !token) return { name: 'login' }
  if (isPublic && token) return { name: 'dashboard' }
})

export default router
