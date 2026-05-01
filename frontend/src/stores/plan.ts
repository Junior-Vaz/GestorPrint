import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '../utils/api'

export interface MyPlan {
  plan: string
  displayName: string
  planStatus: string
  isActive: boolean
  price: number
  trialEndsAt?: string
  planExpiresAt?: string
  // Limits
  maxUsers: number
  maxOrders: number
  maxCustomers: number
  // Usage
  usersCount: number
  ordersThisMonth: number
  customersCount: number
  // Features
  hasPdf: boolean
  hasReports: boolean
  hasKanban: boolean
  hasFileUpload: boolean
  hasWhatsapp: boolean
  hasPix: boolean
  hasAudit: boolean
  hasCommissions: boolean
  hasApiAccess: boolean
  hasPlotterEstimate: boolean
  hasCuttingEstimate: boolean
  hasEmbroideryEstimate: boolean
  hasReceivables: boolean
  // Ecommerce / Loja online
  hasEcommerce: boolean
  hasMpCard: boolean
  hasMelhorEnvios: boolean
  // Programa de Fidelidade
  hasLoyalty: boolean
}

export const usePlanStore = defineStore('plan', () => {
  const data = ref<MyPlan | null>(null)
  const loading = ref(false)
  const limitError = ref('')   // Set when a 403 plan limit is hit

  // ── Feature accessors ────────────────────────────────────────────────────────
  // While loading → false (fail-closed, avoid brief flash of locked features)
  // After load → use plan value; if plan data never arrived → false (fail-closed)
  const hasPdf        = computed(() => loading.value ? false : (data.value?.hasPdf        ?? false))
  const hasReports    = computed(() => loading.value ? false : (data.value?.hasReports    ?? false))
  const hasKanban     = computed(() => loading.value ? false : (data.value?.hasKanban     ?? false))
  const hasFileUpload = computed(() => loading.value ? false : (data.value?.hasFileUpload ?? false))
  const hasWhatsapp   = computed(() => loading.value ? false : (data.value?.hasWhatsapp   ?? false))
  const hasPix        = computed(() => loading.value ? false : (data.value?.hasPix        ?? false))
  const hasAudit      = computed(() => loading.value ? false : (data.value?.hasAudit      ?? false))
  const hasCommissions      = computed(() => loading.value ? false : (data.value?.hasCommissions      ?? false))
  const hasApiAccess        = computed(() => loading.value ? false : (data.value?.hasApiAccess        ?? false))
  const hasPlotterEstimate  = computed(() => loading.value ? false : (data.value?.hasPlotterEstimate  ?? false))
  const hasCuttingEstimate  = computed(() => loading.value ? false : (data.value?.hasCuttingEstimate  ?? false))
  const hasEmbroideryEstimate = computed(() => loading.value ? false : (data.value?.hasEmbroideryEstimate ?? false))
  const hasReceivables        = computed(() => loading.value ? false : (data.value?.hasReceivables        ?? false))
  // Ecommerce / Loja online
  const hasEcommerce      = computed(() => loading.value ? false : (data.value?.hasEcommerce      ?? false))
  const hasMpCard         = computed(() => loading.value ? false : (data.value?.hasMpCard         ?? false))
  const hasMelhorEnvios   = computed(() => loading.value ? false : (data.value?.hasMelhorEnvios   ?? false))
  // Programa de Fidelidade
  const hasLoyalty        = computed(() => loading.value ? false : (data.value?.hasLoyalty        ?? false))

  // ── Plan status ────────────────────────────────────────────────────────────
  const isSuspended = computed(() =>
    data.value?.planStatus === 'SUSPENDED' || data.value?.planStatus === 'CANCELLED'
  )
  const isTrial = computed(() => data.value?.planStatus === 'TRIAL')
  const planName = computed(() => data.value?.displayName || data.value?.plan || '')

  // ── Usage percentages (capped at 100, guarded against division by zero) ────
  const usersPct = computed(() => {
    if (!data.value || !data.value.maxUsers) return 0
    return Math.min(100, Math.round((data.value.usersCount / data.value.maxUsers) * 100))
  })
  const ordersPct = computed(() => {
    if (!data.value || !data.value.maxOrders) return 0
    return Math.min(100, Math.round((data.value.ordersThisMonth / data.value.maxOrders) * 100))
  })
  const customersPct = computed(() => {
    if (!data.value || !data.value.maxCustomers) return 0
    return Math.min(100, Math.round((data.value.customersCount / data.value.maxCustomers) * 100))
  })

  // ── Load plan data ─────────────────────────────────────────────────────────
  async function load() {
    loading.value = true
    try {
      const res = await apiFetch('/api/plans/my')
      if (res.ok) data.value = await res.json()
    } catch {
      // Ignore — fail open, all features enabled
    } finally {
      loading.value = false
    }
  }

  function setLimitError(message: string) {
    limitError.value = message
  }

  function clearLimitError() {
    limitError.value = ''
  }

  return {
    data, loading, limitError,
    hasPdf, hasReports, hasKanban, hasFileUpload, hasWhatsapp, hasPix, hasAudit, hasCommissions, hasApiAccess,
    hasPlotterEstimate, hasCuttingEstimate, hasEmbroideryEstimate, hasReceivables,
    hasEcommerce, hasMpCard, hasMelhorEnvios,
    hasLoyalty,
    isSuspended, isTrial, planName,
    usersPct, ordersPct, customersPct,
    load, setLimitError, clearLimitError,
  }
})
