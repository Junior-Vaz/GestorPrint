import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('gp_user') || 'null'))
  const token = ref(localStorage.getItem('gp_token') || null)

  const isTokenExpired = (tokenStr: string | null) => {
    if (!tokenStr || !tokenStr.includes('.')) return true
    try {
      const parts = tokenStr.split('.')
      if (parts.length < 2) return true
      const payloadPart = parts[1] || ''
      const payload = JSON.parse(atob(payloadPart))
      return payload.exp * 1000 < Date.now()
    } catch (e) {
      return true
    }
  }

  const isAuthenticated = computed(() => !!token.value && !isTokenExpired(token.value))
  const tenantId = computed(() => user.value?.tenantId ?? 1)

  const isAdmin = computed(() => user.value?.role === 'ADMIN' && isAuthenticated.value)
  const isSuperAdmin = computed(() =>
    user.value?.role === 'ADMIN' &&
    (user.value?.tenantId === 1 || user.value?.tenantId == null) &&
    isAuthenticated.value
  )
  const isSales = computed(() => (user.value?.role === 'SALES' || user.value?.role === 'ADMIN') && isAuthenticated.value)
  const isProduction = computed(() => (user.value?.role === 'PRODUCTION' || user.value?.role === 'ADMIN') && isAuthenticated.value)
  const isOnlyProduction = computed(() => user.value?.role === 'PRODUCTION' && isAuthenticated.value)
  const isOnlySales = computed(() => user.value?.role === 'SALES' && isAuthenticated.value)

  const login = (userData: any, accessToken: string) => {
    user.value = userData
    token.value = accessToken
    localStorage.setItem('gp_token', accessToken)
    localStorage.setItem('gp_user', JSON.stringify(userData))
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('gp_token')
    localStorage.removeItem('gp_user')
    // Limpa a aba persistida pra que o próximo login caia em 'home', não na
    // última tela do user anterior (poderia ser uma feature que ele não tem).
    sessionStorage.removeItem('gp_current_tab')
  }

  /**
   * Re-busca dados do user no backend e atualiza store + localStorage.
   * Usado no boot do App.vue pra pegar campos que podem ter sido adicionados
   * depois do login (ex: photoUrl). Se o token estiver inválido, ignora
   * silenciosamente — middleware de 401 já trata o redirect pra login.
   */
  const refreshUser = async () => {
    if (!token.value) return
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token.value}` },
      })
      if (!res.ok) return
      const fresh = await res.json()
      if (fresh && fresh.id) {
        user.value = { ...user.value, ...fresh }
        localStorage.setItem('gp_user', JSON.stringify(user.value))
      }
    } catch { /* falha silenciosa — store antigo continua válido */ }
  }

  return {
    user,
    token,
    tenantId,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isSales,
    isProduction,
    isOnlyProduction,
    isOnlySales,
    login,
    logout,
    refreshUser,
  }
})
