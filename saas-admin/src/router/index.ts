import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import TenantsView from '../views/TenantsView.vue'
import TenantDetailView from '../views/TenantDetailView.vue'
import PlansView from '../views/PlansView.vue'
import SettingsView from '../views/SettingsView.vue'
import LogsView from '../views/LogsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/tenants', name: 'tenants', component: TenantsView },
    { path: '/tenants/:id', name: 'tenant-detail', component: TenantDetailView },
    { path: '/plans', name: 'plans', component: PlansView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/logs', name: 'logs', component: LogsView },
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
