import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('sa_user') || 'null'))
  const token = ref(localStorage.getItem('sa_token') || null)

  const isTokenExpired = (tokenStr: string | null) => {
    if (!tokenStr || !tokenStr.includes('.')) return true
    try {
      const payload = JSON.parse(atob(tokenStr.split('.')[1] || ''))
      return payload.exp * 1000 < Date.now()
    } catch {
      return true
    }
  }

  const isAuthenticated = computed(() => !!token.value && !isTokenExpired(token.value))

  const login = (userData: any, accessToken: string) => {
    user.value = userData
    token.value = accessToken
    localStorage.setItem('sa_token', accessToken)
    localStorage.setItem('sa_user', JSON.stringify(userData))
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('sa_token')
    localStorage.removeItem('sa_user')
  }

  return { user, token, isAuthenticated, login, logout }
})
