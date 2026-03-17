import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('gp_user') || 'null'))
  const token = ref(localStorage.getItem('gp_token') || null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const isSales = computed(() => user.value?.role === 'SALES' || user.value?.role === 'ADMIN')
  const isProduction = computed(() => user.value?.role === 'PRODUCTION' || user.value?.role === 'ADMIN')

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
    login,
    logout
  }
})
