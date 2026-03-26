<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const suspendedMsg = ref('')

const auth = useAuthStore()

onMounted(() => {
  const msg = sessionStorage.getItem('suspended_msg')
  if (msg) {
    suspendedMsg.value = msg
    sessionStorage.removeItem('suspended_msg')
  }
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value })
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || 'Falha no login')
    }

    const { user, access_token } = await res.json()
    auth.login(user, access_token)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
    <div class="w-full max-w-md animate-in fade-in zoom-in duration-500">
      <!-- Logo AREA -->
      <div class="flex flex-col items-center mb-10">
        <div class="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center border-4 border-white shadow-xl mb-4">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        </div>
        <h1 class="text-3xl font-black text-slate-900 tracking-tighter">GestorPrint ERP</h1>
        <p class="text-slate-500 font-bold mt-1">Gerencie sua gráfica com precisão inteligente</p>
      </div>

      <!-- Login Card -->
      <div class="bg-white p-10 rounded-[40px] border border-slate-200 shadow-2xl shadow-indigo-100 flex flex-col items-center">
        <h2 class="text-xl font-black text-slate-800 mb-8 self-start">Entrar no Sistema</h2>

        <form @submit.prevent="handleLogin" class="w-full space-y-6">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">E-mail Corporativo</label>
            <input 
              v-model="email"
              type="email" 
              required
              placeholder="exemplo@grafica.com"
              class="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
            />
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Senha</label>
            <input 
              v-model="password"
              type="password" 
              required
              placeholder="••••••••"
              class="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
            />
          </div>

          <div v-if="suspendedMsg" class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-start gap-2">
            <svg class="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            {{ suspendedMsg }}
          </div>

          <div v-if="error" class="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold animate-shake">
            ⚠️ {{ error }}
          </div>

          <button 
            type="submit" 
            :disabled="loading"
            class="w-full bg-slate-900 group relative overflow-hidden text-white font-black py-5 rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-70">
            <span v-if="!loading" class="relative z-10 flex items-center justify-center gap-2">
              Acessar Painel 
              <svg class="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
            </span>
            <span v-else class="flex items-center justify-center">
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </span>
          </button>
        </form>

        <p class="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
          Dificuldades no acesso? <br>
          <a href="https://wa.me/5561999989402?text=Olá,%20preciso%20de%20ajuda!%20com%20o%20acesso%20ao%20painel" target="_blank" class="text-indigo-600 text-[10px] cursor-pointer hover:underline mt-1 block">Contate o Administrador</a>
        </p>
      </div>

      <p class="mt-10 text-center text-slate-400 text-xs font-medium">
        GestorPrint ERP v2.0 &copy; 2026
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.animate-shake {
  animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
}
</style>
