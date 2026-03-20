<template>
  <SidebarLayout>
    <div class="p-6 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-slate-500">{{ tenants.length }} tenant{{ tenants.length !== 1 ? 's' : '' }} cadastrado{{ tenants.length !== 1 ? 's' : '' }}</p>
        </div>
        <button @click="openCreate" class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Novo Tenant
        </button>
      </div>

      <!-- Filters -->
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
          <input v-model="searchQuery" placeholder="Buscar por nome, slug ou responsável..." class="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div class="flex gap-1">
          <button v-for="f in STATUS_FILTERS" :key="f.value" @click="statusFilter = f.value"
            :class="['px-3 py-2 rounded-xl text-xs font-semibold transition-colors', statusFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50']">
            {{ f.label }}
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                <th class="px-4 py-3 font-semibold">Nome / Slug</th>
                <th class="px-4 py-3 font-semibold">Responsável</th>
                <th class="px-4 py-3 font-semibold">Plano</th>
                <th class="px-4 py-3 font-semibold">Status</th>
                <th class="px-4 py-3 font-semibold">Usuários</th>
                <th class="px-4 py-3 font-semibold">Pedidos</th>
                <th class="px-4 py-3 font-semibold">Criado em</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="t in filteredTenants" :key="t.id" class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3">
                  <p class="font-semibold text-slate-800">{{ t.name }}</p>
                  <p class="text-xs text-slate-400 font-mono">{{ t.slug }}</p>
                </td>
                <td class="px-4 py-3">
                  <p class="text-slate-700">{{ t.ownerName || '—' }}</p>
                  <p class="text-xs text-slate-400">{{ t.ownerEmail || '' }}</p>
                </td>
                <td class="px-4 py-3">
                  <span :class="['px-2 py-0.5 rounded-md text-xs font-bold', PLAN_BADGE[t.plan] || 'bg-slate-100 text-slate-600']">{{ t.plan }}</span>
                </td>
                <td class="px-4 py-3">
                  <span :class="['px-2.5 py-0.5 rounded-full text-xs font-semibold', STATUS_COLORS[t.planStatus] || 'bg-slate-100 text-slate-500']">{{ t.planStatus }}</span>
                </td>
                <td class="px-4 py-3 text-slate-600 tabular-nums">
                  {{ t._count?.users ?? 0 }}<span class="text-slate-300">/{{ t.maxUsers }}</span>
                </td>
                <td class="px-4 py-3 text-slate-600 tabular-nums">
                  {{ t._count?.orders ?? 0 }}<span class="text-slate-300">/{{ t.maxOrders }}</span>
                </td>
                <td class="px-4 py-3 text-slate-400 text-xs">{{ formatDate(t.createdAt) }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-1 justify-end">
                    <button @click="openEdit(t)" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button v-if="t.isActive" @click="suspend(t.id)" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Suspender">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                    </button>
                    <button v-else @click="activate(t.id)" class="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Ativar">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredTenants.length === 0">
                <td colspan="8" class="px-4 py-12 text-center text-slate-400 text-sm">Nenhum tenant encontrado</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" @click.self="showModal = false">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="px-7 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
          <h2 class="text-base font-bold text-slate-800">{{ isEditing ? 'Editar Tenant' : 'Novo Tenant' }}</h2>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 p-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="px-7 py-5 space-y-5">
          <!-- Nome + Slug -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1.5">Nome *</label>
              <input v-model="form.name" @input="autoSlug" placeholder="Gráfica XYZ" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1.5">Slug *</label>
              <input v-model="form.slug" placeholder="grafica-xyz" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <!-- Planos -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-2">Plano</label>
            <div class="grid grid-cols-4 gap-2">
              <button v-for="p in PLANS" :key="p.value" @click="form.plan = p.value" type="button"
                :class="['border-2 rounded-2xl p-3 text-center transition-all', form.plan === p.value ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300']">
                <span :class="[p.color, 'inline-block w-3 h-3 rounded-full mb-1.5']"></span>
                <p class="text-xs font-bold text-slate-800">{{ p.label }}</p>
                <p class="text-xs text-slate-400 mt-0.5">R$ {{ p.price }}/mês</p>
              </button>
            </div>
          </div>

          <!-- Status + isActive -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1.5">Status do Plano</label>
              <select v-model="form.planStatus" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="TRIAL">TRIAL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div class="flex items-end pb-1">
              <label class="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" v-model="form.isActive" class="w-4 h-4 rounded text-indigo-600 accent-indigo-600" />
                <span class="text-sm font-semibold text-slate-700">Tenant Ativo</span>
              </label>
            </div>
          </div>

          <!-- Datas -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1.5">Fim do Trial</label>
              <input type="date" v-model="form.trialEndsAt" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1.5">Vencimento do Plano</label>
              <input type="date" v-model="form.planExpiresAt" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <!-- Limites -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1.5">Máx. Usuários</label>
              <input type="number" v-model.number="form.maxUsers" min="1" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1.5">Máx. Pedidos/mês</label>
              <input type="number" v-model.number="form.maxOrders" min="1" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <!-- Owner -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-2">Responsável</label>
            <div class="grid grid-cols-3 gap-3">
              <input v-model="form.ownerName" placeholder="Nome completo" class="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input v-model="form.ownerPhone" placeholder="Telefone" class="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input v-model="form.ownerEmail" type="email" placeholder="E-mail" class="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div class="px-7 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button @click="showModal = false" class="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
          <button @click="save" :disabled="saving" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
            {{ saving ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Criar Tenant') }}
          </button>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SidebarLayout from '../components/SidebarLayout.vue'
import { apiFetch } from '../utils/api'

interface Tenant {
  id: number; name: string; slug: string; plan: string; planStatus: string;
  isActive: boolean; ownerName?: string; ownerEmail?: string; ownerPhone?: string;
  maxUsers: number; maxOrders: number; trialEndsAt?: string; planExpiresAt?: string;
  createdAt: string;
  _count?: { users: number; orders: number; customers: number };
}

const PLANS = [
  { value: 'FREE',       label: 'Free',       price: 0,   color: 'bg-slate-400' },
  { value: 'BASIC',      label: 'Basic',      price: 49,  color: 'bg-blue-500'  },
  { value: 'PRO',        label: 'Pro',        price: 149, color: 'bg-indigo-600' },
  { value: 'ENTERPRISE', label: 'Enterprise', price: 299, color: 'bg-purple-700' },
]
const PLAN_BADGE: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600', BASIC: 'bg-blue-100 text-blue-700',
  PRO: 'bg-indigo-100 text-indigo-700', ENTERPRISE: 'bg-purple-100 text-purple-700',
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
  ownerName: '', ownerEmail: '', ownerPhone: '',
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
  const res = await apiFetch('/api/tenants')
  if (res.ok) tenants.value = await res.json()
}

const openCreate = () => {
  form.value = emptyForm()
  isEditing.value = false
  editingId.value = null
  showModal.value = true
}
const openEdit = (t: Tenant) => {
  form.value = {
    name: t.name, slug: t.slug, plan: t.plan, planStatus: t.planStatus,
    isActive: t.isActive,
    trialEndsAt: t.trialEndsAt ? t.trialEndsAt.substring(0, 10) : '',
    planExpiresAt: t.planExpiresAt ? t.planExpiresAt.substring(0, 10) : '',
    maxUsers: t.maxUsers, maxOrders: t.maxOrders,
    ownerName: t.ownerName || '', ownerEmail: t.ownerEmail || '', ownerPhone: t.ownerPhone || '',
  }
  isEditing.value = true
  editingId.value = t.id
  showModal.value = true
}

const save = async () => {
  saving.value = true
  const payload: any = { ...form.value }
  if (!payload.trialEndsAt) payload.trialEndsAt = null
  if (!payload.planExpiresAt) payload.planExpiresAt = null
  const url = isEditing.value ? `/api/tenants/${editingId.value}` : '/api/tenants'
  const res = await apiFetch(url, {
    method: isEditing.value ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  saving.value = false
  if (res.ok) { showModal.value = false; await fetchTenants() }
}

const suspend = async (id: number) => {
  await apiFetch(`/api/tenants/${id}/suspend`, { method: 'PATCH' })
  await fetchTenants()
}
const activate = async (id: number) => {
  await apiFetch(`/api/tenants/${id}/activate`, { method: 'PATCH' })
  await fetchTenants()
}

onMounted(fetchTenants)
</script>
