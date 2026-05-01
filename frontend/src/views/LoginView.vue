<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiFetch } from '../utils/api'
import { useAuthStore } from '../stores/auth'

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const remember = ref(true)
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
  const savedEmail = localStorage.getItem('gp_last_email')
  if (savedEmail) email.value = savedEmail
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value })
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || 'Falha no login')
    }

    const { user, access_token } = await res.json()
    if (remember.value) localStorage.setItem('gp_last_email', email.value)
    else localStorage.removeItem('gp_last_email')
    auth.login(user, access_token)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[minmax(0,520px)_1fr] bg-white">
    <!-- ═══ Lado esquerdo — formulário ════════════════════════════════════ -->
    <div class="relative flex flex-col px-6 sm:px-10 lg:px-14 py-8 lg:py-10">
      <!-- Logo -->
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <span class="text-sm font-medium text-slate-900 tracking-tight">GestorPrint</span>
      </div>

      <!-- Form wrapper -->
      <div class="flex-1 flex items-center justify-center">
        <div class="w-full max-w-[380px] animate-rise">
          <!-- Chip decorativo -->
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-[11px] text-slate-500">
            <span class="relative flex w-1.5 h-1.5">
              <span class="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style="background:#1D9E75"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5" style="background:#1D9E75"></span>
            </span>
            Sistema online
          </div>

          <h1 class="text-[28px] leading-tight font-medium text-slate-900 mt-5 tracking-tight">
            Entre na sua gráfica
          </h1>
          <p class="text-[13px] text-slate-500 mt-2">Continue de onde parou. Tudo que precisa para produzir, vender e receber.</p>

          <form @submit.prevent="handleLogin" class="mt-8 space-y-4">
            <div>
              <label class="block text-xs text-slate-600 mb-1.5 font-medium">E-mail</label>
              <div class="relative group">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 group-focus-within:text-slate-700 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </span>
                <input
                  v-model="email"
                  type="email"
                  required
                  autocomplete="email"
                  placeholder="voce@suagráfica.com.br"
                  class="w-full border border-slate-200 rounded-xl pl-9 pr-3.5 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs text-slate-600 font-medium">Senha</label>
                <a
                  href="https://wa.me/5561999989402?text=Ol%C3%A1%2C%20esqueci%20minha%20senha%20do%20GestorPrint"
                  target="_blank"
                  rel="noopener"
                  class="text-xs text-slate-500 hover:text-slate-900 transition-colors"
                >Esqueci a senha</a>
              </div>
              <div class="relative group">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 group-focus-within:text-slate-700 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m0 0v2m-3-4h6m-7-4V9a4 4 0 118 0v2m-9 0h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2z"/></svg>
                </span>
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                  :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                >
                  <svg v-if="!showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer pt-1 select-none">
              <input
                type="checkbox"
                v-model="remember"
                class="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-400"
              />
              <span class="text-xs text-slate-600">Lembrar meu e-mail neste dispositivo</span>
            </label>

            <div
              v-if="suspendedMsg"
              class="flex items-start gap-2.5 p-3.5 rounded-xl text-sm border"
              style="background:#FAEEDA; color:#854F0B; border-color:#F5D9A8"
            >
              <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>{{ suspendedMsg }}</span>
            </div>

            <div
              v-if="error"
              class="flex items-start gap-2.5 p-3.5 rounded-xl text-sm border animate-shake"
              style="background:#FCEBEB; color:#A32D2D; border-color:#F5C7C7"
            >
              <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>{{ error }}</span>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="group relative w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium rounded-xl py-3 transition-all shadow-lg shadow-slate-900/10 active:scale-[0.99]"
            >
              <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <span>{{ loading ? 'Entrando...' : 'Entrar no painel' }}</span>
              <svg v-if="!loading" class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </button>
          </form>

          <!-- Support -->
          <div class="mt-10 flex items-center gap-3">
            <div class="h-px flex-1 bg-slate-100"></div>
            <span class="text-[11px] text-slate-400">precisa de ajuda?</span>
            <div class="h-px flex-1 bg-slate-100"></div>
          </div>
          <a
            href="https://wa.me/5561999989402?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20acesso%20ao%20GestorPrint"
            target="_blank"
            rel="noopener"
            class="mt-4 w-full inline-flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl py-2.5 transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            Falar com o suporte no WhatsApp
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-[11px] text-slate-400 flex items-center justify-between">
        <span>GestorPrint ERP · v2.0 · © 2026</span>
        <span class="hidden sm:inline">Brasília · Brasil</span>
      </div>
    </div>

    <!-- ═══ Lado direito — painel visual premium ═══════════════════════════ -->
    <aside class="hidden lg:block relative overflow-hidden">
      <!-- Background: slate profundo com gradient -->
      <div class="absolute inset-0" style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 45%, #0F172A 100%);"></div>

      <!-- Grade sutil -->
      <div class="absolute inset-0 opacity-[0.06]" style="background-image: linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px); background-size: 32px 32px;"></div>

      <!-- Glows coloridos -->
      <div class="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-float-slow" style="background: radial-gradient(circle at center, #1D9E75 0%, transparent 70%)"></div>
      <div class="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl animate-float" style="background: radial-gradient(circle at center, #7C3AED 0%, transparent 70%)"></div>
      <div class="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full opacity-20 blur-3xl animate-float-slower" style="background: radial-gradient(circle at center, #38BDF8 0%, transparent 70%)"></div>

      <div class="relative h-full flex flex-col justify-between px-12 xl:px-16 py-14 xl:py-20">
        <!-- Top: headline -->
        <div class="max-w-md">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/10 text-[11px] text-white/80">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Novo · agente de IA no WhatsApp
          </div>
          <h2 class="text-[42px] xl:text-[52px] leading-[1.05] font-medium text-white mt-6 tracking-tight">
            Sua gráfica<br/>
            <span class="bg-clip-text text-transparent" style="background-image: linear-gradient(90deg, #A7F3D0 0%, #6EE7B7 50%, #34D399 100%)">sem atritos.</span>
          </h2>
          <p class="text-[15px] text-white/60 mt-5 leading-relaxed">
            Orçamento, produção, PDV e financeiro em uma única plataforma moderna — feita pra quem imprime todo dia.
          </p>
        </div>

        <!-- Middle: dashboard preview -->
        <div class="mt-10 mb-10 relative">
          <!-- KPI strip -->
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div class="rounded-xl bg-white/[0.04] backdrop-blur border border-white/[0.08] px-4 py-3.5">
              <div class="text-[10px] uppercase tracking-wider text-white/40">Receita</div>
              <div class="text-lg font-medium text-white mt-1">R$ 48.2k</div>
              <div class="flex items-center gap-1 text-[10px] mt-0.5" style="color:#6EE7B7">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                +18%
              </div>
            </div>
            <div class="rounded-xl bg-white/[0.04] backdrop-blur border border-white/[0.08] px-4 py-3.5">
              <div class="text-[10px] uppercase tracking-wider text-white/40">Produção</div>
              <div class="text-lg font-medium text-white mt-1">23</div>
              <div class="text-[10px] text-white/40 mt-0.5">pedidos ativos</div>
            </div>
            <div class="rounded-xl bg-white/[0.04] backdrop-blur border border-white/[0.08] px-4 py-3.5">
              <div class="text-[10px] uppercase tracking-wider text-white/40">Pix recebido</div>
              <div class="text-lg font-medium text-white mt-1">R$ 12.4k</div>
              <div class="flex items-center gap-1 text-[10px] mt-0.5" style="color:#6EE7B7">
                <span class="w-1 h-1 rounded-full animate-pulse" style="background:#6EE7B7"></span>
                ao vivo
              </div>
            </div>
          </div>

          <!-- Kanban mini -->
          <div class="rounded-xl bg-white/[0.04] backdrop-blur border border-white/[0.08] p-4">
            <div class="flex items-center justify-between mb-3">
              <span class="text-[11px] font-medium text-white/80">Produção — hoje</span>
              <span class="text-[10px] text-white/40">kanban</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <!-- Col: Pendente -->
              <div>
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="w-1 h-1 rounded-full bg-white/30"></span>
                  <span class="text-[9px] uppercase tracking-wider text-white/40">Pendente</span>
                </div>
                <div class="space-y-1.5">
                  <div class="rounded-lg bg-white/[0.06] border border-white/[0.06] px-2.5 py-2">
                    <div class="text-[10px] text-white font-medium truncate">Banner 2x1m</div>
                    <div class="text-[9px] text-white/40 mt-0.5">Ana M.</div>
                  </div>
                  <div class="rounded-lg bg-white/[0.06] border border-white/[0.06] px-2.5 py-2">
                    <div class="text-[10px] text-white font-medium truncate">Cartão 500un</div>
                    <div class="text-[9px] text-white/40 mt-0.5">Carlos T.</div>
                  </div>
                </div>
              </div>
              <!-- Col: Em produção -->
              <div>
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="w-1 h-1 rounded-full" style="background:#FBBF24"></span>
                  <span class="text-[9px] uppercase tracking-wider text-white/40">Produção</span>
                </div>
                <div class="space-y-1.5">
                  <div class="rounded-lg border px-2.5 py-2" style="background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.15)">
                    <div class="text-[10px] text-white font-medium truncate">Adesivo recorte</div>
                    <div class="flex items-center justify-between mt-1">
                      <div class="text-[9px] text-white/40">Lúcia R.</div>
                      <div class="w-6 h-0.5 rounded-full bg-white/10 overflow-hidden">
                        <div class="h-full rounded-full animate-progress" style="background:#FBBF24"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Col: Concluído -->
              <div>
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="w-1 h-1 rounded-full" style="background:#6EE7B7"></span>
                  <span class="text-[9px] uppercase tracking-wider text-white/40">Concluído</span>
                </div>
                <div class="space-y-1.5">
                  <div class="rounded-lg border px-2.5 py-2" style="background: rgba(110,231,183,0.08); border-color: rgba(110,231,183,0.18)">
                    <div class="text-[10px] text-white font-medium truncate">Flyer A5</div>
                    <div class="flex items-center gap-1 text-[9px] mt-0.5" style="color:#6EE7B7">
                      <svg class="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                      entregue
                    </div>
                  </div>
                  <div class="rounded-lg border px-2.5 py-2" style="background: rgba(110,231,183,0.08); border-color: rgba(110,231,183,0.18)">
                    <div class="text-[10px] text-white font-medium truncate">Lona 3x2m</div>
                    <div class="text-[9px] text-white/40 mt-0.5">pago · Pix</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Incoming WhatsApp notification -->
          <div class="absolute -right-4 -bottom-4 animate-rise-slow">
            <div class="rounded-xl bg-white shadow-2xl shadow-black/40 px-3.5 py-2.5 flex items-center gap-2.5 max-w-[260px]">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background:#E1F5EE">
                <svg class="w-3.5 h-3.5" fill="none" stroke="#1D9E75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-[11px] text-slate-900 font-medium truncate">Novo orçamento no WhatsApp</div>
                <div class="text-[10px] text-slate-500 truncate">Cliente · 200 cartões frente e verso</div>
              </div>
              <span class="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style="background:#1D9E75"></span>
            </div>
          </div>
        </div>

        <!-- Bottom: trust -->
        <div class="flex items-center justify-between gap-6 pt-6 border-t border-white/[0.06]">
          <div>
            <div class="flex items-center -space-x-2">
              <div class="w-7 h-7 rounded-full text-[10px] font-medium flex items-center justify-center ring-2 ring-slate-900" style="background:#E6F1FB; color:#0C447C">MR</div>
              <div class="w-7 h-7 rounded-full text-[10px] font-medium flex items-center justify-center ring-2 ring-slate-900" style="background:#FAEEDA; color:#854F0B">JC</div>
              <div class="w-7 h-7 rounded-full text-[10px] font-medium flex items-center justify-center ring-2 ring-slate-900" style="background:#E1F5EE; color:#0F6E56">LP</div>
              <div class="w-7 h-7 rounded-full text-[10px] font-medium flex items-center justify-center ring-2 ring-slate-900 text-white/80 bg-white/10">+42</div>
            </div>
            <div class="text-[11px] text-white/60 mt-2">gráficas confiam no GestorPrint</div>
          </div>
          <div class="text-right">
            <div class="flex items-center gap-0.5 justify-end" style="color:#FBBF24">
              <svg v-for="n in 5" :key="n" class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.6 7.3L22 10l-5.8 5 1.8 7-6-3.8L6 22l1.8-7L2 10l7.4-.7z"/></svg>
            </div>
            <div class="text-[11px] text-white/60 mt-1">4.9 · 128 avaliações</div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.animate-shake { animation: shake 0.25s cubic-bezier(.36,.07,.19,.97) both; }

@keyframes rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-rise { animation: rise 0.5s cubic-bezier(.16,1,.3,1) both; }

@keyframes rise-slow {
  0%   { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-rise-slow { animation: rise-slow 0.8s cubic-bezier(.16,1,.3,1) 0.4s both; }

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(20px, -30px); }
}
.animate-float { animation: float 14s ease-in-out infinite; }

@keyframes float-slow {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-25px, 20px); }
}
.animate-float-slow { animation: float-slow 18s ease-in-out infinite; }

@keyframes float-slower {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(15px, -15px); }
}
.animate-float-slower { animation: float-slower 22s ease-in-out infinite; }

@keyframes progress {
  0%   { width: 10%; }
  50%  { width: 75%; }
  100% { width: 45%; }
}
.animate-progress { animation: progress 4s ease-in-out infinite; }
</style>
