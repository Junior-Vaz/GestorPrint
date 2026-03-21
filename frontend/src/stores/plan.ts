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
}

export const usePlanStore = defineStore('plan', () => {
  const data = ref<MyPlan | null>(null)
  const loading = ref(false)
  const limitError = ref('')   // Set when a 403 plan limit is hit

  // ── Feature accessors (default true when plan not loaded — fail open) ──────
  const hasPdf        = computed(() => data.value?.hasPdf        ?? true)
  const hasReports    = computed(() => data.value?.hasReports    ?? true)
  const hasKanban     = computed(() => data.value?.hasKanban     ?? true)
  const hasFileUpload = computed(() => data.value?.hasFileUpload ?? true)
  const hasWhatsapp   = computed(() => data.value?.hasWhatsapp   ?? true)
  const hasPix        = computed(() => data.value?.hasPix        ?? true)
  const hasAudit      = computed(() => data.value?.hasAudit      ?? true)
  const hasCommissions = computed(() => data.value?.hasCommissions ?? true)

  // ── Plan status ────────────────────────────────────────────────────────────
  const isSuspended = computed(() =>
    data.value?.planStatus === 'SUSPENDED' || data.value?.planStatus === 'CANCELLED'
  )
  const isTrial = computed(() => data.value?.planStatus === 'TRIAL')
  const planName = computed(() => data.value?.displayName || data.value?.plan || '')

  // ── Usage percentages (capped at 100) ─────────────────────────────────────
  const usersPct = computed(() => {
    if (!data.value) return 0
    return Math.min(100, Math.round((data.value.usersCount / data.value.maxUsers) * 100))
  })
  const ordersPct = computed(() => {
    if (!data.value) return 0
    return Math.min(100, Math.round((data.value.ordersThisMonth / data.value.maxOrders) * 100))
  })
  const customersPct = computed(() => {
    if (!data.value) return 0
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
    hasPdf, hasReports, hasKanban, hasFileUpload, hasWhatsapp, hasPix, hasAudit, hasCommissions,
    isSuspended, isTrial, planName,
    usersPct, ordersPct, customersPct,
    load, setLimitError, clearLimitError,
  }
})
