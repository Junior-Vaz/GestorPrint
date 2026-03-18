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
  const isAdmin = computed(() => user.value?.role === 'ADMIN' && isAuthenticated.value)
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
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    isSales,
    isProduction,
    isOnlyProduction,
    isOnlySales,
    login,
    logout
  }
})
