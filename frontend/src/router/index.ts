import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { usePlanStore } from '../stores/plan'
import type { MyPlan } from '../stores/plan'

/**
 * Cada rota pode declarar `meta.feature: keyof MyPlan` (ou array, pra OR).
 * Quando a flag está false no plan store, o guard redireciona pra home com
 * mensagem amigável. Mantém a UX do sidebar (clique mostra cadeado) mas
 * cobre o caso de digitar URL direto.
 */
type FeatureKey = keyof Pick<MyPlan,
  'hasPdf' | 'hasReports' | 'hasKanban' | 'hasFileUpload' |
  'hasWhatsapp' | 'hasPix' | 'hasAudit' | 'hasCommissions' | 'hasApiAccess' |
  'hasPlotterEstimate' | 'hasCuttingEstimate' | 'hasEmbroideryEstimate' |
  'hasReceivables' | 'hasEcommerce' | 'hasMpCard' | 'hasMelhorEnvios'
>

const FEATURE_LABELS: Record<FeatureKey, string> = {
  hasPdf: 'Geração de PDF',
  hasReports: 'Relatórios & BI',
  hasKanban: 'Fila de Produção',
  hasFileUpload: 'Upload de arquivos',
  hasWhatsapp: 'Agente de IA',
  hasPix: 'Pagamentos PIX',
  hasAudit: 'Auditoria',
  hasCommissions: 'Comissões',
  hasApiAccess: 'Acesso à API',
  hasPlotterEstimate: 'Orçamento de plotter',
  hasCuttingEstimate: 'Orçamento de recorte',
  hasEmbroideryEstimate: 'Orçamento de estamparia',
  hasReceivables: 'Contas a receber/pagar',
  hasEcommerce: 'Loja online',
  hasMpCard: 'Cartão Mercado Pago',
  hasMelhorEnvios: 'Frete Melhor Envios',
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/orcamento/:uuid', name: 'public-estimate', component: () => import('../views/PublicEstimateView.vue'), meta: { public: true } },

  { path: '/products',  name: 'products',  component: () => import('../views/ProductsView.vue') },
  { path: '/customers', name: 'customers', component: () => import('../views/CustomersView.vue') },

  // Estimates — base não gateaada (orçamento de serviço sempre disponível)
  { path: '/estimates', redirect: '/estimates/service' },
  { path: '/estimates/service',    name: 'estimates-service',    component: () => import('../views/estimates/EstimatesServiceView.vue') },
  { path: '/estimates/plotter',    name: 'estimates-plotter',    component: () => import('../views/estimates/EstimatesPlotterView.vue'),    meta: { feature: 'hasPlotterEstimate' } },
  { path: '/estimates/cutting',    name: 'estimates-cutting',    component: () => import('../views/estimates/EstimatesCuttingView.vue'),    meta: { feature: 'hasCuttingEstimate' } },
  { path: '/estimates/embroidery', name: 'estimates-embroidery', component: () => import('../views/estimates/EstimatesEmbroideryView.vue'), meta: { feature: 'hasEmbroideryEstimate' } },

  { path: '/pdv',       name: 'pdv',       component: () => import('../views/PdvView.vue') },
  { path: '/expenses',  name: 'expenses',  component: () => import('../views/ExpensesView.vue') },
  { path: '/financial', name: 'financial', component: () => import('../views/FinancialView.vue') },

  { path: '/reports',  name: 'reports',  component: () => import('../views/ReportsView.vue'),  meta: { feature: 'hasReports' } },
  { path: '/audit',    name: 'audit',    component: () => import('../views/AuditView.vue'),    meta: { feature: 'hasAudit' } },
  { path: '/ai',       name: 'ai',       component: () => import('../views/AiView.vue'),       meta: { feature: 'hasWhatsapp' } },

  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/users',    name: 'users',    component: () => import('../views/UsersView.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  // Impersonate handoff — Saas Admin redireciona pra cá com ?impersonate=<jwt>.
  // Salva como sessão atual (sobrescreve qualquer sessão anterior) e remove o
  // param da URL pra não vazar token no histórico.
  const impersonateToken = to.query?.impersonate as string | undefined
  if (impersonateToken) {
    localStorage.setItem('gp_token', impersonateToken)
    localStorage.setItem('gp_impersonate', '1') // flag pra UI poder mostrar banner "modo impersonate"
    const cleanQuery = { ...to.query }
    delete cleanQuery.impersonate
    return { path: '/', query: cleanQuery, replace: true }
  }

  const token = localStorage.getItem('gp_token')
  const publicRoutes = ['login', 'public-estimate']

  if (to.meta?.public) return true

  // Auth gate
  if (!publicRoutes.includes(to.name as string) && !token) {
    return { name: 'login' }
  }

  // Feature gate — defesa contra "digitei /reports na URL"
  // A sidebar já bloqueia o clique, mas alguém pode acessar via URL direta.
  // Aqui redirecionamos pra home com mensagem amigável.
  const featureMeta = to.meta?.feature
  if (featureMeta) {
    const plan = usePlanStore()
    // Se ainda está carregando o plan, deixa passar (HomeView espera o load)
    // — quando carregar, se não tiver acesso, o usuário será redirecionado
    // pelo próprio store ao tentar interagir.
    if (plan.loading) return true

    const features: FeatureKey[] = Array.isArray(featureMeta)
      ? (featureMeta as FeatureKey[])
      : [featureMeta as FeatureKey]
    const allowed = features.every(f => (plan as any)[f] === true)
    if (!allowed) {
      const firstFeature = features[0]
      const label = (firstFeature && FEATURE_LABELS[firstFeature]) || 'Esta funcionalidade'
      plan.setLimitError(`${label} não está disponível no seu plano.`)
      return { name: 'home' }
    }
  }
})

export default router
