<template>
  <SidebarLayout>
    <div class="p-6 max-w-7xl mx-auto space-y-6">

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <div class="p-2 bg-purple-500 rounded-xl text-white shadow-lg shadow-purple-100">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            Gestão de Tenants
          </h1>
          <p class="text-slate-500 mt-1 font-medium italic">
            {{ filteredTenants.length }} de {{ tenants.length }} tenant{{ tenants.length !== 1 ? 's' : '' }} exibido{{ filteredTenants.length !== 1 ? 's' : '' }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="fetchTenants"
            :disabled="loading"
            class="flex items-center gap-2 px-4 py-2.5 bg-white/80 hover:bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <svg v-if="!loading" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <div v-else class="h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
            Atualizar
          </button>
          <button
            @click="openCreate"
            class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Novo Tenant
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/40 shadow-xl shadow-slate-200/60 flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
          <input v-model="searchQuery" placeholder="Buscar por nome, slug ou responsável..."
            class="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div class="flex gap-1 flex-wrap">
          <button v-for="f in STATUS_FILTERS" :key="f.value" @click="statusFilter = f.value"
            :class="['px-3 py-2 rounded-xl text-xs font-bold transition-all', statusFilter === f.value ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50']">
            {{ f.label }}
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div class="w-2 h-6 bg-purple-500 rounded-full"></div>
            Todos os Tenants
          </h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-100">
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nome / Slug</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Responsável</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Plano</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Usuários</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pedidos</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Criado em</th>
                <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="t in filteredTenants" :key="t.id" class="hover:bg-indigo-50/30 transition-colors group">
                <td class="px-6 py-4">
                  <p class="font-bold text-slate-800">{{ t.name }}</p>
                  <p class="text-xs text-slate-400 font-mono">{{ t.slug }}</p>
                </td>
                <td class="px-6 py-4">
                  <p class="text-sm font-semibold text-slate-700">{{ t.ownerName || '—' }}</p>
                  <p class="text-xs text-slate-400">{{ t.ownerEmail || '' }}</p>
                </td>
                <td class="px-6 py-4">
                  <span :class="['px-3 py-1 rounded-lg text-xs font-black inline-flex', planBadgeClass(t.plan)]">{{ t.plan }}</span>
                </td>
                <td class="px-6 py-4">
                  <span :class="['px-3 py-1 rounded-full text-xs font-black inline-flex', STATUS_COLORS[t.planStatus] || 'bg-slate-100 text-slate-500']">{{ t.planStatus }}</span>
                </td>
                <td class="px-6 py-4 text-sm font-semibold text-slate-600 tabular-nums">
                  {{ t._count?.users ?? 0 }}<span class="text-slate-300 font-normal">/{{ t.maxUsers }}</span>
                </td>
                <td class="px-6 py-4 text-sm font-semibold text-slate-600 tabular-nums">
                  {{ t._count?.orders ?? 0 }}<span class="text-slate-300 font-normal">/{{ t.maxOrders }}</span>
                </td>
                <td class="px-6 py-4">
                  <span class="text-sm font-semibold text-slate-500">{{ formatDate(t.createdAt) }}</span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button @click="openEdit(t)"
                      class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button v-if="t.isActive" @click="suspend(t.id)"
                      class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Suspender">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                      </svg>
                    </button>
                    <button v-else @click="activate(t.id)"
                      class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Ativar">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredTenants.length === 0 && !loading">
                <td colspan="8" class="px-6 py-12 text-center text-slate-400 font-medium italic">
                  Nenhum tenant encontrado.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Criar Tenant (rápido) -->
    <div v-if="showModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="showModal = false">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
        <div class="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-lg font-bold text-slate-800">Novo Tenant</h2>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="px-7 py-5 space-y-4">
          <p class="text-xs text-slate-500 italic">Criação rápida. Os demais dados (endereço, CNPJ, plano completo, etc.) são preenchidos na página do tenant.</p>

          <!-- Nome + Slug -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome *</label>
              <input v-model="form.name" @input="autoSlug" placeholder="Gráfica XYZ"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Slug *</label>
              <input v-model="form.slug" placeholder="grafica-xyz"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <!-- Planos -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plano</label>
            <div class="grid grid-cols-4 gap-2">
              <button v-for="p in plansList.filter(pl => pl.isActive)" :key="p.name" @click="form.plan = p.name" type="button"
                :class="['border-2 rounded-2xl p-3 text-center transition-all', form.plan === p.name ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-slate-200 hover:border-indigo-300']">
                <span :class="[PLAN_COLORS[p.name] || 'bg-slate-400', 'inline-block w-3 h-3 rounded-full mb-1.5']"></span>
                <p class="text-xs font-extrabold text-slate-800">{{ p.displayName }}</p>
                <p class="text-xs text-slate-400 mt-0.5">{{ p.price === 0 ? 'Grátis' : `R$ ${p.price}/mês` }}</p>
              </button>
            </div>
          </div>

          <!-- Responsável (básico) -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome do Responsável</label>
              <input v-model="form.ownerName" placeholder="Nome completo"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail do Responsável</label>
              <input v-model="form.ownerEmail" type="email" placeholder="email@empresa.com"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div class="px-7 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button @click="showModal = false"
            class="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
          <button @click="save" :disabled="saving"
            class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95">
            {{ saving ? 'Criando...' : 'Criar Tenant' }}
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

interface Tenant {
  id: number; name: string; slug: string; plan: string; planStatus: string;
  isActive: boolean; ownerName?: string; ownerEmail?: string; ownerPhone?: string;
  cpfCnpj?: string;
  maxUsers: number; maxOrders: number; trialEndsAt?: string; planExpiresAt?: string;
  createdAt: string;
  _count?: { users: number; orders: number; customers: number };
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
  FREE: 'bg-slate-400', BASIC: 'bg-blue-500', PRO: 'bg-indigo-600', ENTERPRISE: 'bg-purple-700',
}
const planBadgeClass = (name: string) => {
  const map: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-600', BASIC: 'bg-blue-100 text-blue-700',
    PRO: 'bg-indigo-100 text-indigo-700', ENTERPRISE: 'bg-purple-100 text-purple-700',
  }
  return map[name] ?? 'bg-slate-100 text-slate-600'
}
const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-amber-100 text-amber-700', ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-700', CANCELLED: 'bg-slate-100 text-slate-500',
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

const filteredTenants = computed(() => {
  let list = tenants.value
  if (statusFilter.value) list = list.filter(t => t.planStatus === statusFilter.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.ownerName || '').toLowerCase().includes(q) ||
      (t.ownerEmail || '').toLowerCase().includes(q)
    )
  }
  return list
})

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
  const res = await apiFetch('/api/tenants')
  if (res.ok) tenants.value = await res.json()
  loading.value = false
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
  const payload: any = { ...form.value }
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
