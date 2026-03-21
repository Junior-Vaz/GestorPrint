<template>
  <div class="min-h-screen bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
    <!-- Background blobs -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-48 -right-48 w-125 h-125 bg-indigo-600/15 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-48 -left-48 w-125 h-125 bg-purple-600/10 rounded-full blur-3xl"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/5 rounded-full blur-2xl"></div>
    </div>

    <div class="relative w-full max-w-md">
      <!-- Logo area -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-5 shadow-2xl shadow-indigo-900/50">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <h1 class="text-3xl font-extrabold text-white tracking-tight">GestorPrint</h1>
        <p class="text-indigo-300/70 text-sm mt-1.5 font-medium">Painel de Administração SaaS</p>
      </div>

      <!-- Card -->
      <div class="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
        <h2 class="text-lg font-extrabold text-white mb-6">Entrar no Admin</h2>

        <!-- Error -->
        <Transition name="fade">
          <div v-if="error"
            class="mb-5 flex items-start gap-3 bg-red-500/15 border border-red-500/30 text-red-300 rounded-2xl px-4 py-3 text-sm font-medium">
            <svg class="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            {{ error }}
          </div>
        </Transition>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">E-mail</label>
            <input
              v-model="email"
              type="email"
              placeholder="admin@gestorprint.com"
              class="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              required
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Senha</label>
            <input
              v-model="password"
              type="password"
              placeholder="••••••••"
              class="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              required
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-900/40 active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
          >
            <div v-if="loading" class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {{ loading ? 'Entrando...' : 'Entrar no Painel' }}
          </button>
        </form>
      </div>

      <p class="text-center text-white/20 text-xs mt-6 font-medium">
        Acesso restrito ao administrador da plataforma
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })

    if (!res.ok) {
      error.value = 'E-mail ou senha incorretos.'
      return
    }

    const data = await res.json()
    const user = data.user

    if (user?.tenantId !== 1 || user?.role !== 'ADMIN') {
      error.value = 'Acesso restrito ao administrador da plataforma.'
      return
    }

    auth.login(user, data.access_token)
    router.push('/dashboard')
  } catch {
    error.value = 'Erro de conexão. Verifique se o servidor está online.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
