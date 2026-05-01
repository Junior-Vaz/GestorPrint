<template>
  <!-- Login com vibe "operations console" — fundo escuro como a sidebar do app, sem blobs nem glassmorphism -->
  <div class="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative">
    <div class="relative w-full max-w-sm">
      <!-- Logo area -->
      <div class="mb-8">
        <div class="inline-flex items-center gap-2.5 mb-1">
          <div class="w-8 h-8 rounded-md bg-white flex items-center justify-center">
            <svg class="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <h1 class="text-base font-medium text-white tracking-tight">GestorPrint</h1>
        </div>
        <p class="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">SaaS Admin · Login</p>
      </div>

      <!-- Card -->
      <div class="bg-slate-900 rounded-md border border-slate-800 p-6">
        <p class="text-[11px] font-mono text-slate-500 uppercase tracking-[0.15em] mb-4">Acesso restrito</p>

        <!-- Error -->
        <Transition name="fade">
          <div v-if="error"
            class="mb-4 flex items-start gap-2 bg-red-950/40 border border-red-900/60 text-red-300 rounded-md px-3 py-2 text-xs">
            <svg class="w-3.5 h-3.5 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            {{ error }}
          </div>
        </Transition>

        <form @submit.prevent="handleLogin" class="space-y-3">
          <div>
            <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="admin@gestorprint.com"
              class="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-500 transition-colors"
              required
            />
          </div>
          <div>
            <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="••••••••"
              class="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-500 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-medium py-2 rounded-md text-xs transition-colors mt-1 flex items-center justify-center gap-2"
          >
            <span v-if="loading" class="h-3.5 w-3.5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></span>
            {{ loading ? 'Autenticando...' : 'Entrar' }}
          </button>
        </form>
      </div>

      <p class="text-center text-slate-600 text-[10px] mt-4 font-mono uppercase tracking-wider">
        Restrito · Super admin only
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
    // Endpoint dedicado pra PLATFORM users — backend rejeita TENANT users com
    // 401 mesmo se a senha estiver certa. Sem mais "fallback de tenant 1".
    const res = await fetch('/api/auth/saas-login', {
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

    // Defesa em camadas: backend já garantiu, mas confirmamos no client antes
    // de logar. Se algum dia o backend voltar acidentalmente, ainda barramos.
    if (user?.userType !== 'PLATFORM') {
      error.value = 'Acesso restrito à equipe da plataforma.'
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
