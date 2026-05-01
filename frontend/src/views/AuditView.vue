<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { apiFetch } from '../utils/api'
import PaginationControls from '../components/shared/PaginationControls.vue'

const logs = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')
const actionFilter = ref('')
const startDate = ref('')
const endDate = ref('')

const fetchLogs = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
    if (search.value) params.set('search', search.value)
    if (actionFilter.value) params.set('status', actionFilter.value)
    if (startDate.value) params.set('startDate', startDate.value)
    if (endDate.value) params.set('endDate', endDate.value)

    const res = await apiFetch(`/api/audit?${params}`)
    if (!res.ok) return
    const result = await res.json()
    if (Array.isArray(result)) {
      logs.value = result; total.value = result.length; totalPages.value = 1
    } else {
      logs.value = result.data; total.value = result.total; totalPages.value = result.totalPages
    }
  } catch (error) {
    console.error('Erro ao buscar logs:', error)
  } finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; fetchLogs() }, 300)
watch(search, debouncedSearch)
watch([page, limit, actionFilter, startDate, endDate], fetchLogs)
onMounted(fetchLogs)

const initials = (name: string) =>
  (name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || 'SY'

// ── Humaniza a ação pro usuário final ────────────────────────────────────────
const ENTITY_LABEL: Record<string, string> = {
  Order: 'Pedido', Orders: 'Pedido',
  Estimate: 'Orçamento', Estimates: 'Orçamento',
  Customer: 'Cliente', Customers: 'Cliente',
  Product: 'Insumo', Products: 'Insumo',
  ProductType: 'Tipo de insumo',
  Supplier: 'Fornecedor', Suppliers: 'Fornecedor',
  User: 'Usuário', Users: 'Usuário',
  Invoice: 'Fatura',
  Bill: 'Conta a pagar',
  Expense: 'Despesa',
  ExpenseCategory: 'Categoria de despesa',
  Payment: 'Pagamento',
  Transaction: 'Transação',
  Settings: 'Configurações',
  Attachment: 'Anexo',
  Tenant: 'Tenant',
  Plan: 'Plano',
  Subscription: 'Assinatura',
}

const pickName = (details: any): string => {
  if (!details || typeof details !== 'object') return ''
  return details.name
      || details.customerName
      || details.customer?.name
      || details.description
      || details.email
      || details.title
      || ''
}

const describeAction = (log: any): string => {
  const entity = ENTITY_LABEL[log.entity] || log.entity || 'registro'
  const target = pickName(log.details)
  const ref = log.entityId ? `#${String(log.entityId).padStart(4, '0')}` : ''

  const past = log.action === 'CREATE' ? 'criado'
             : log.action === 'UPDATE' ? 'editado'
             : log.action === 'DELETE' ? 'excluído'
             : log.action === 'CANCEL' ? 'cancelado'
             : log.action === 'PAY'    ? 'marcado como pago'
             : log.action?.toLowerCase() || 'alterado'

  // Casos especiais com "para cliente X"
  if (log.action === 'CREATE' && (log.entity === 'Estimate' || log.entity === 'Estimates') && target) {
    return `Orçamento criado para ${target}`
  }
  if (log.action === 'CREATE' && (log.entity === 'Order' || log.entity === 'Orders') && target) {
    return `Pedido criado para ${target}`
  }
  if (log.action === 'PAY' && target) {
    return `Pagamento registrado — ${target}`
  }

  // Com identificador: "Cliente João editado" / "Insumo Papel A4 excluído"
  if (target) {
    return `${entity} "${target}" ${past}`
  }

  // Fallback: "Orçamento #0042 editado"
  return `${entity}${ref ? ' ' + ref : ''} ${past}`.trim()
}

const detailsRaw = (details: any): string => {
  if (!details) return ''
  try { return typeof details === 'string' ? details : JSON.stringify(details, null, 2) }
  catch { return '' }
}
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Auditoria</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="total > 0">{{ total }} {{ total === 1 ? 'evento registrado' : 'eventos registrados' }}</span>
            <span v-else>Rastreamento de ações do sistema</span>
          </div>
        </div>
        <button @click="fetchLogs" :disabled="loading"
                class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors disabled:opacity-50">
          <svg v-if="!loading" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span v-else class="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></span>
          Atualizar
        </button>
      </div>

      <!-- Filtros -->
      <div class="flex items-center gap-2 mb-5 flex-wrap">
        <div class="relative flex-1 max-w-md min-w-[220px]">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="text" placeholder="Buscar por entidade…"
                 class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
        </div>

        <!-- Tabs de ação coloridas -->
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            v-for="tab in [
              { key: '',       label: 'Todas',    color: '#0F172A', soft: '#F1F5F9' },
              { key: 'CREATE', label: 'Criação',  color: '#1D9E75', soft: '#E1F5EE' },
              { key: 'UPDATE', label: 'Edição',   color: '#BA7517', soft: '#FAEEDA' },
              { key: 'DELETE', label: 'Exclusão', color: '#A32D2D', soft: '#FCEBEB' },
            ]"
            :key="tab.key"
            @click="actionFilter = tab.key"
            :class="['shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-colors border',
              actionFilter === tab.key ? 'font-medium' : 'bg-white hover:bg-slate-50']"
            :style="actionFilter === tab.key
              ? { backgroundColor: tab.soft, color: tab.color, borderColor: tab.color }
              : { color: '#64748B', borderColor: '#E2E8F0' }">
            <span v-if="tab.key" class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: tab.color }"></span>
            {{ tab.label }}
          </button>
        </div>

        <input type="date" v-model="startDate"
               class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
        <input type="date" v-model="endDate"
               class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
      </div>

      <!-- Lista -->
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <!-- Loading -->
        <div v-if="loading && logs.length === 0" class="p-1">
          <div v-for="i in 6" :key="`l${i}`"
               class="grid grid-cols-[160px_180px_110px_1fr] gap-4 items-center py-4 px-5 border-b border-slate-100 last:border-0">
            <div class="h-3 bg-slate-100 rounded animate-pulse w-28"></div>
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-full bg-slate-100 animate-pulse"></div>
              <div class="h-3 bg-slate-100 rounded animate-pulse w-24"></div>
            </div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-64"></div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="logs.length === 0" class="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div class="text-sm font-medium text-slate-900 mb-1">Nenhum evento</div>
          <div class="text-xs text-slate-500 max-w-xs">
            {{ search || actionFilter || startDate || endDate ? 'Nada bate com esses filtros.' : 'Nenhuma ação auditada ainda.' }}
          </div>
        </div>

        <!-- Eventos -->
        <div v-else>
          <div class="grid grid-cols-[160px_180px_110px_1fr] gap-4 text-[11px] text-slate-400 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <span>Quando</span>
            <span>Operador</span>
            <span>Ação</span>
            <span>O que aconteceu</span>
          </div>

          <div v-for="log in logs" :key="log.id"
               class="grid grid-cols-[160px_180px_110px_1fr] gap-4 items-center py-3.5 px-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-sm">
            <span class="text-xs text-slate-500 whitespace-nowrap">
              {{ log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '—' }}
            </span>

            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center shrink-0">
                {{ initials(log.user?.name || '') }}
              </span>
              <span class="text-slate-900 truncate">{{ log.user?.name || 'Sistema' }}</span>
            </div>

            <span>
              <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                    :style="log.action === 'CREATE' ? { background: '#E1F5EE', color: '#0F6E56' }
                          : log.action === 'UPDATE' ? { background: '#FAEEDA', color: '#854F0B' }
                          : log.action === 'DELETE' ? { background: '#FCEBEB', color: '#A32D2D' }
                          : { background: '#F1EFE8', color: '#5F5E5A' }">
                <span class="w-1.5 h-1.5 rounded-full"
                      :style="log.action === 'CREATE' ? { background: '#1D9E75' }
                            : log.action === 'UPDATE' ? { background: '#BA7517' }
                            : log.action === 'DELETE' ? { background: '#A32D2D' }
                            : { background: '#888780' }"></span>
                {{ log.action === 'CREATE' ? 'Criou' : log.action === 'UPDATE' ? 'Editou' : log.action === 'DELETE' ? 'Excluiu' : log.action }}
              </span>
            </span>

            <div class="min-w-0" :title="detailsRaw(log.details)">
              <div class="text-slate-900 truncate">{{ describeAction(log) }}</div>
              <div v-if="log.entityId" class="text-[11px] text-slate-400 mt-0.5">
                {{ ENTITY_LABEL[log.entity] || log.entity }} · #{{ String(log.entityId).padStart(4, '0') }}
              </div>
            </div>
          </div>

          <div class="border-t border-slate-100 px-4">
            <PaginationControls v-model:page="page" v-model:limit="limit" :total="total" :total-pages="totalPages"/>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
