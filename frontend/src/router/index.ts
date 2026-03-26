import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/products',
      name: 'products',
      component: () => import('../views/ProductsView.vue')
    },
    {
      path: '/customers',
      name: 'customers',
      component: () => import('../views/CustomersView.vue')
    },
    {
      path: '/estimates',
      redirect: '/estimates/service'
    },
    {
      path: '/estimates/service',
      name: 'estimates-service',
      component: () => import('../views/estimates/EstimatesServiceView.vue'),
    },
    {
      path: '/estimates/plotter',
      name: 'estimates-plotter',
      component: () => import('../views/estimates/EstimatesPlotterView.vue'),
    },
    {
      path: '/estimates/cutting',
      name: 'estimates-cutting',
      component: () => import('../views/estimates/EstimatesCuttingView.vue'),
    },
    {
      path: '/estimates/embroidery',
      name: 'estimates-embroidery',
      component: () => import('../views/estimates/EstimatesEmbroideryView.vue'),
    },
    {
      path: '/estimates/new',
      name: 'new-estimate',
      component: () => import('../views/EstimateCalculator.vue')
    },
    {
      path: '/pdv',
      name: 'pdv',
      component: () => import('../views/PdvView.vue')
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: () => import('../views/ExpensesView.vue')
    },
    {
      path: '/financial',
      name: 'financial',
      component: () => import('../views/FinancialView.vue')
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('../views/ReportsView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('../views/UsersView.vue')
    },
    {
      path: '/ai',
      name: 'ai',
      component: () => import('../views/AiView.vue')
    },
    {
      path: '/audit',
      name: 'audit',
      component: () => import('../views/AuditView.vue')
    }
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('gp_token')
  const publicRoutes = ['login']
  if (!publicRoutes.includes(to.name as string) && !token) {
    return { name: 'login' }
  }
})

export default router
