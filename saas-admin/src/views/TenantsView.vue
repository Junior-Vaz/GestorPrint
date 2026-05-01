<template>
  <SidebarLayout>
    <div class="p-6 max-w-7xl mx-auto space-y-5">

      <!-- Header -->
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-[11px] font-mono text-slate-400 uppercase tracking-[0.18em]">
            {{ filteredTenants.length }} de {{ tenants.length }} {{ tenants.length === 1 ? 'tenant' : 'tenants' }}
          </p>
          <h1 class="text-[22px] font-medium text-slate-900 mt-0.5 tracking-tight">Tenants</h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="fetchTenants"
            :disabled="loading"
            class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <svg v-if="!loading" class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <div v-else class="h-3.5 w-3.5 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
            Atualizar
          </button>
          <button
            @click="openCreate"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Novo tenant
          </button>
        </div>
      </div>

      <!-- Tabs: Clientes (default) vs Plataforma (tenant 1, ghost) -->
      <div class="flex items-center gap-1 border-b border-slate-200">
        <button @click="scopeTab = 'clients'; onFilterChange()"
          :class="['px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px',
            scopeTab === 'clients'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-500 border-transparent hover:text-slate-700']">
          Clientes
        </button>
        <button @click="scopeTab = 'platform'; onFilterChange()"
          :class="['px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px inline-flex items-center gap-1.5',
            scopeTab === 'platform'
              ? 'text-violet-700 border-violet-700'
              : 'text-slate-500 border-transparent hover:text-violet-600']">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 12l2 2 4-4"/>
          </svg>
          Plataforma
        </button>
      </div>

      <!-- Banner explicativo na aba Plataforma -->
      <div v-if="scopeTab === 'platform'"
        class="bg-violet-50 border border-violet-200 rounded-md px-4 py-3 flex items-start gap-3">
        <svg class="w-4 h-4 text-violet-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div class="text-[12px] text-violet-900 leading-relaxed">
          <strong>Tenant da plataforma SaaS</strong> — onde sua equipe de operação vive (PLATFORM users).
          Não é uma gráfica cliente. Não tem dados operacionais (pedidos, clientes finais).
          Edite só pra trocar nome/slug exibido em logs.
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white border border-slate-200 rounded-md p-3 flex flex-col sm:flex-row gap-2">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
          <input v-model="searchQuery" @input="onSearchChange" placeholder="Buscar por nome, slug ou responsável..."
            class="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-400 transition-colors" />
        </div>
        <div class="flex gap-1 flex-wrap">
          <button v-for="f in STATUS_FILTERS" :key="f.value"
            @click="statusFilter = f.value; onFilterChange()"
            :class="['px-3 py-2 rounded-md text-[11px] font-mono uppercase tracking-wider transition-colors',
              statusFilter === f.value
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50']">
            {{ f.label }}
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/50">
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Nome / Slug</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Responsável</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Plano</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Status</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Usuários</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Pedidos</th>
                <th class="px-5 py-2.5 text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Criado em</th>
                <th class="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in filteredTenants" :key="t.id"
                :class="['border-b border-slate-50 last:border-0 transition-colors group cursor-pointer',
                  t.id === 1
                    ? 'bg-violet-50/40 hover:bg-violet-50/70'
                    : 'hover:bg-slate-50/60']"
                @click="router.push(`/tenants/${t.id}`)">
                <td class="px-5 py-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p :class="['text-sm font-medium', t.id === 1 ? 'text-violet-900' : 'text-slate-900']">
                      {{ t.name }}
                    </p>
                    <!-- Badge de "PLATAFORMA" no tenant 1 — visual diferenciado pra
                         deixar inequívoco que ele NÃO é uma gráfica cliente. -->
                    <span v-if="t.id === 1"
                      class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
                      Plataforma
                    </span>
                    <!-- Alertas inline (trial/plano vencendo) -->
                    <span v-for="a in (t._alerts || [])" :key="a.code"
                      :class="['inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider',
                        a.type === 'danger'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700']">
                      {{ a.message }}
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-400 font-mono mt-0.5">{{ t.slug }}</p>
                </td>
                <td class="px-5 py-3">
                  <p class="text-xs text-slate-700">{{ t.ownerName || '—' }}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">{{ t.ownerEmail || '' }}</p>
                </td>
                <td class="px-5 py-3">
                  <span :class="['inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider', planBadgeClass(t.plan)]">{{ t.plan }}</span>
                </td>
                <td class="px-5 py-3">
                  <span :class="['inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider', STATUS_COLORS[t.planStatus] || 'bg-slate-100 text-slate-500']">{{ t.planStatus }}</span>
                </td>
                <td class="px-5 py-3 text-xs text-slate-700 tabular-nums">
                  {{ t._count?.users ?? 0 }}<span class="text-slate-300">/{{ t.maxUsers }}</span>
                </td>
                <td class="px-5 py-3 text-xs text-slate-700 tabular-nums">
                  {{ t._count?.orders ?? 0 }}<span class="text-slate-300">/{{ t.maxOrders }}</span>
                </td>
                <td class="px-5 py-3 text-xs text-slate-500 font-mono">{{ formatDate(t.createdAt) }}</td>
                <td class="px-5 py-3" @click.stop>
                  <div class="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button @click="openEdit(t)"
                      class="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors" title="Editar">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button v-if="t.isActive" @click="suspend(t.id)"
                      class="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="Suspender">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                      </svg>
                    </button>
                    <button v-else @click="activate(t.id)"
                      class="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors" title="Ativar">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredTenants.length === 0 && !loading">
                <td colspan="8" class="px-5 py-12 text-center text-xs text-slate-400">
                  Nenhum tenant encontrado.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginação -->
        <div v-if="!loading && total > 0" class="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <div class="text-slate-500">
            Página <span class="font-medium text-slate-900">{{ page }}</span> de
            <span class="font-medium text-slate-900">{{ totalPages }}</span>
            <span class="text-slate-400">·</span>
            <span class="text-slate-400">{{ total }} tenant{{ total !== 1 ? 's' : '' }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button @click="goToPage(page - 1)" :disabled="page <= 1"
              class="px-3 py-1.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 text-slate-700 transition-colors">← Anterior</button>
            <button @click="goToPage(page + 1)" :disabled="page >= totalPages"
              class="px-3 py-1.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 text-slate-700 transition-colors">Próxima →</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Criar Tenant (rápido) -->
    <div v-if="showModal" class="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" @click.self="showModal = false">
      <div class="bg-white rounded-md border border-slate-200 shadow-xl w-full max-w-lg">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p class="text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Plataforma · Tenants</p>
            <h2 class="text-sm font-medium text-slate-900 mt-0.5">Novo tenant</h2>
          </div>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="px-5 py-4 space-y-4">
          <p class="text-[11px] text-slate-500">
            Criação rápida. Endereço, CNPJ, plano completo etc. são preenchidos na página do tenant depois.
          </p>

          <!-- Nome + Slug -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Nome *</label>
              <input v-model="form.name" @input="autoSlug" placeholder="Gráfica XYZ"
                class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors" />
            </div>
            <div>
              <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Slug *</label>
              <input v-model="form.slug" placeholder="grafica-xyz"
                class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-slate-400 transition-colors" />
            </div>
          </div>

          <!-- Planos -->
          <div>
            <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Plano</label>
            <div class="grid grid-cols-4 gap-2">
              <button v-for="p in plansList.filter(pl => pl.isActive)" :key="p.name" @click="form.plan = p.name" type="button"
                :class="['border rounded-md p-2.5 text-center transition-colors',
                  form.plan === p.name
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 hover:border-slate-400 text-slate-700']">
                <span :class="[PLAN_COLORS[p.name] || 'bg-slate-400', 'inline-block w-2 h-2 rounded-sm mb-1']"></span>
                <p class="text-[11px] font-medium">{{ p.displayName }}</p>
                <p class="text-[10px] opacity-70 mt-0.5">{{ p.price === 0 ? 'Grátis' : `R$ ${p.price}/mês` }}</p>
              </button>
            </div>
          </div>

          <!-- Responsável (básico) -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Nome do responsável</label>
              <input v-model="form.ownerName" placeholder="Nome completo"
                class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors" />
            </div>
            <div>
              <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">E-mail do responsável</label>
              <input v-model="form.ownerEmail" type="email" placeholder="email@empresa.com"
                class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400 transition-colors" />
            </div>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
          <button @click="showModal = false"
            class="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancelar</button>
          <button @click="save" :disabled="saving"
            class="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            <span v-if="saving" class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            {{ saving ? 'Criando...' : 'Criar tenant' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de erro/aviso/sucesso -->
    <AlertModal
      :show="alert.show"
      :type="alert.type"
      :title="alert.title"
      :message="alert.message"
      @close="alert.show = false"
    />
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SidebarLayout from '../components/SidebarLayout.vue'
import AlertModal from '../components/AlertModal.vue'
import { apiFetch } from '../utils/api'

const router = useRouter()

interface TenantAlert { type: 'warning' | 'danger'; message: string; code: string }
interface Tenant {
  id: number; name: string; slug: string; plan: string; planStatus: string;
  isActive: boolean; ownerName?: string; ownerEmail?: string; ownerPhone?: string;
  cpfCnpj?: string;
  maxUsers: number; maxOrders: number; trialEndsAt?: string; planExpiresAt?: string;
  createdAt: string;
  _count?: { users: number; orders: number; customers: number };
  _alerts?: TenantAlert[];
}

// Plans loaded dynamically from /api/plans
interface PlanConfig { id: number; name: string; displayName: string; price: number; isActive: boolean; sortOrder: number }
const plansList = ref<PlanConfig[]>([])
const loadPlans = async () => {
  try {
    const res = await apiFetch('/api/plans')
    if (res.ok) plansList.value = await res.json()
  } catch { /* ignore — will use empty list */ }
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-400', BASIC: 'bg-blue-500', PRO: 'bg-indigo-600', ENTERPRISE: 'bg-violet-600',
}
const planBadgeClass = (name: string) => {
  const map: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-600', BASIC: 'bg-blue-50 text-blue-700',
    PRO: 'bg-indigo-50 text-indigo-700', ENTERPRISE: 'bg-violet-50 text-violet-700',
  }
  return map[name] ?? 'bg-slate-100 text-slate-600'
}
const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-amber-50 text-amber-700', ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-red-50 text-red-700', CANCELLED: 'bg-slate-100 text-slate-500',
}
const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'TRIAL', label: 'Trial' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'SUSPENDED', label: 'Suspensos' },
  { value: 'CANCELLED', label: 'Cancelados' },
]

const tenants = ref<Tenant[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const alert = ref({ show: false, type: 'error' as 'error' | 'warning' | 'success', title: '', message: '' })
const showAlert = (type: 'error' | 'warning' | 'success', title: string, message: string) => {
  alert.value = { show: true, type, title, message }
}
const parseError = async (res: Response): Promise<string> => {
  try {
    const err = await res.json()
    const msg = err?.message || err?.error || 'Erro desconhecido'
    return Array.isArray(msg) ? msg.join(', ') : String(msg)
  } catch { return `Erro ${res.status}` }
}
const searchQuery = ref('')
const statusFilter = ref('')
// scopeTab: 'clients' (gráficas reais) | 'platform' (tenant 1, ghost da plataforma).
// Default 'clients' — é o uso operacional 99% das vezes.
const scopeTab = ref<'clients' | 'platform'>('clients')
const showModal = ref(false)
const saving = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)

const emptyForm = () => ({
  name: '', slug: '', plan: 'FREE', planStatus: 'TRIAL' as string,
  isActive: true, trialEndsAt: '', planExpiresAt: '',
  maxUsers: 3, maxOrders: 100,
  ownerName: '', ownerEmail: '', ownerPhone: '', cpfCnpj: '',
})
const form = ref(emptyForm())

// Filtros são server-side agora — `filteredTenants` espelha `tenants`
// (mantido como computed só pra preservar a referência usada no template).
const filteredTenants = computed(() => tenants.value)

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const autoSlug = () => {
  if (!isEditing.value) {
    form.value.slug = form.value.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }
}

const fetchTenants = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page:     String(page.value),
      pageSize: String(pageSize.value),
      scope:    scopeTab.value,
    })
    if (searchQuery.value)  params.set('search', searchQuery.value.trim())
    if (statusFilter.value) params.set('status', statusFilter.value)

    const res = await apiFetch(`/api/tenants?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      // Compat com versão antiga (array cru) — só por segurança em rolling deploy
      if (Array.isArray(json)) {
        tenants.value = json
        total.value = json.length
      } else {
        tenants.value = json.data || []
        total.value = json.total || 0
      }
    }
  } finally { loading.value = false }
}

// Reset pra página 1 quando filtros mudam
const onFilterChange = () => {
  page.value = 1
  fetchTenants()
}

// Debounce na busca pra não bater no backend a cada tecla
let searchTimer: ReturnType<typeof setTimeout> | null = null
const onSearchChange = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchTenants()
  }, 300)
}

const goToPage = (p: number) => {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchTenants()
}

const openCreate = () => {
  form.value = emptyForm()
  isEditing.value = false
  editingId.value = null
  showModal.value = true
}
const openEdit = (t: Tenant) => {
  router.push(`/tenants/${t.id}`)
}

const save = async () => {
  saving.value = true

  // Limpa o payload antes de enviar:
  // - Strings vazias viram undefined → backend pula validação @IsOptional
  //   (class-validator não trata "" como ausência por padrão).
  // - cpfCnpj: remove qualquer coisa que não seja dígito (form pode ter máscara).
  // - Email: validação básica antes de bater no backend pra mensagem amigável.
  const payload: any = {}
  for (const [k, v] of Object.entries(form.value)) {
    if (v === '' || v === null || v === undefined) continue
    payload[k] = v
  }
  if (payload.cpfCnpj) payload.cpfCnpj = String(payload.cpfCnpj).replace(/\D/g, '')

  // Validação client-side de email — evita roundtrip pro backend só pra
  // pegar erro de formato. Mostra mensagem amigável no frontend.
  if (payload.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.ownerEmail)) {
    showAlert('error', 'Email inválido', `"${payload.ownerEmail}" não é um email válido. Verifique e tente novamente.`)
    saving.value = false
    return
  }

  try {
    const res = await apiFetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const created = await res.json()
      showModal.value = false
      router.push(`/tenants/${created.id}`)
    } else {
      showAlert('error', 'Erro ao criar tenant', await parseError(res))
    }
  } catch {
    showAlert('error', 'Erro de Conexão', 'Não foi possível criar o tenant.')
  } finally {
    saving.value = false
  }
}

const suspend = async (id: number) => {
  try {
    const res = await apiFetch(`/api/tenants/${id}/suspend`, { method: 'PATCH' })
    if (res.ok) { await fetchTenants() }
    else { showAlert('error', 'Erro ao suspender', await parseError(res)) }
  } catch { showAlert('error', 'Erro de Conexão', 'Não foi possível suspender o tenant.') }
}
const activate = async (id: number) => {
  try {
    const res = await apiFetch(`/api/tenants/${id}/activate`, { method: 'PATCH' })
    if (res.ok) { await fetchTenants() }
    else { showAlert('error', 'Erro ao ativar', await parseError(res)) }
  } catch { showAlert('error', 'Erro de Conexão', 'Não foi possível ativar o tenant.') }
}

onMounted(async () => {
  await Promise.all([fetchTenants(), loadPlans()])
})
</script>
