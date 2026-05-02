<script setup lang="ts">
/**
 * Auditoria global da plataforma — super admin vê eventos de TODOS os tenants.
 *
 * Diferenças vs ERP AuditView:
 *  - Endpoint: /api/audit/platform (sem filtro pelo tenantId do JWT)
 *  - Mostra coluna `Gráfica` em cada linha pra contextualizar
 *  - Filtro de tenantId opcional (drilldown num tenant específico)
 *  - Foco visual em eventos de plataforma: LOGIN_FAILED, PlatformUser CRUD,
 *    Tenant SUSPEND/ACTIVATE, PlanConfig, RolePermission
 */
import { ref, watch, onMounted } from 'vue'
import SidebarLayout from '../components/SidebarLayout.vue'

const logs       = ref<any[]>([])
const tenants    = ref<any[]>([])
const loading    = ref(false)
const page       = ref(1)
const limit      = ref(30)
const total      = ref(0)
const totalPages = ref(0)
const search       = ref('')
const actionFilter = ref('')
const tenantFilter = ref<string>('') // '' = todos
const startDate    = ref('')
const endDate      = ref('')

// ── Fetch ────────────────────────────────────────────────────────────────────
const apiBase = '/api'
const authHeader = (): Record<string, string> => {
  const t = localStorage.getItem('sa_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const fetchTenants = async () => {
  // Lista de tenants pra dropdown — usa o mesmo endpoint do TenantsView, mas
  // com pageSize alto pra cobrir todos sem paginação na UI.
  try {
    const res = await fetch(`${apiBase}/tenants?page=1&pageSize=200&scope=all`, { headers: authHeader() })
    if (!res.ok) return
    const d = await res.json()
    tenants.value = Array.isArray(d) ? d : (d.data ?? [])
  } catch { /* silent — filtro fica indisponível, não é blocker */ }
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
    if (search.value)       params.set('search', search.value)
    if (actionFilter.value) params.set('status', actionFilter.value)
    if (tenantFilter.value) params.set('tenantId', tenantFilter.value)
    if (startDate.value)    params.set('startDate', startDate.value)
    if (endDate.value)      params.set('endDate', endDate.value)

    const res = await fetch(`${apiBase}/audit/platform?${params}`, { headers: authHeader() })
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('sa_token')
        window.location.href = '/login'
        return
      }
      logs.value = []
      total.value = 0
      totalPages.value = 0
      return
    }
    const d = await res.json()
    if (Array.isArray(d)) {
      logs.value = d; total.value = d.length; totalPages.value = 1
    } else {
      logs.value = d.data ?? []; total.value = d.total ?? 0; totalPages.value = d.totalPages ?? 0
    }
  } catch (e) {
    console.error('Erro ao buscar audit:', e)
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; fetchLogs() }, 300)
})
watch([page, limit, actionFilter, tenantFilter, startDate, endDate], fetchLogs)

onMounted(() => {
  fetchTenants()
  fetchLogs()
})

// ── Helpers visuais (mesmo vocabulário do ERP) ───────────────────────────────
const initials = (name: string) =>
  (name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || 'SY'

const ENTITY_LABEL: Record<string, string> = {
  Order: 'Pedido', Estimate: 'Orçamento', Customer: 'Cliente', Product: 'Insumo',
  ProductType: 'Tipo de insumo', Supplier: 'Fornecedor',
  User: 'Usuário', PlatformUser: 'Membro da plataforma',
  Invoice: 'Fatura', Bill: 'Conta a pagar',
  Expense: 'Despesa', ExpenseCategory: 'Categoria de despesa',
  Payment: 'Pagamento', Transaction: 'Transação',
  Settings: 'Configurações', 'Settings.pricingConfig': 'Tabela de preços',
  Attachment: 'Anexo', Tenant: 'Gráfica', Plan: 'Plano', PlanConfig: 'Plano da plataforma',
  Subscription: 'Assinatura', RolePermission: 'Permissão',
  LoyaltyConfig: 'Configuração de fidelidade', LoyaltyTransaction: 'Saldo de fidelidade',
  EvolutionInstance: 'Instância WhatsApp',
}

interface ActionMeta { past: string; shortLabel: string; color: string; soft: string }
const ACTION_META: Record<string, ActionMeta> = {
  CREATE:         { past: 'criado',          shortLabel: 'Criou',     color: '#0F6E56', soft: '#E1F5EE' },
  UPDATE:         { past: 'editado',         shortLabel: 'Editou',    color: '#854F0B', soft: '#FAEEDA' },
  DELETE:         { past: 'excluído',        shortLabel: 'Excluiu',   color: '#A32D2D', soft: '#FCEBEB' },
  LOGIN:          { past: 'entrou',          shortLabel: 'Login',     color: '#3C3489', soft: '#EEEDFE' },
  LOGIN_FAILED:   { past: 'tentou entrar',   shortLabel: 'Falha login', color: '#A32D2D', soft: '#FCEBEB' },
  RESET_DEFAULTS: { past: 'restaurado',      shortLabel: 'Restaurou', color: '#854F0B', soft: '#FAEEDA' },
  APPROVE:        { past: 'aprovado',        shortLabel: 'Aprovou',   color: '#0F6E56', soft: '#E1F5EE' },
  REJECT:         { past: 'rejeitado',       shortLabel: 'Rejeitou',  color: '#A32D2D', soft: '#FCEBEB' },
  SEND:           { past: 'enviado',         shortLabel: 'Enviou',    color: '#0C447C', soft: '#E6F1FB' },
  CANCEL:         { past: 'cancelado',       shortLabel: 'Cancelou',  color: '#A32D2D', soft: '#FCEBEB' },
  SUSPEND:        { past: 'suspenso',        shortLabel: 'Suspendeu', color: '#A32D2D', soft: '#FCEBEB' },
  ACTIVATE:       { past: 'ativado',         shortLabel: 'Ativou',    color: '#0F6E56', soft: '#E1F5EE' },
  DEACTIVATE:     { past: 'desativado',      shortLabel: 'Desativou', color: '#A32D2D', soft: '#FCEBEB' },
  ENABLE:         { past: 'ligado',          shortLabel: 'Ligou',     color: '#0F6E56', soft: '#E1F5EE' },
  DISABLE:        { past: 'desligado',       shortLabel: 'Desligou',  color: '#5F5E5A', soft: '#F1EFE8' },
  MARK_PAID:      { past: 'marcado como pago', shortLabel: 'Pagou',  color: '#0F6E56', soft: '#E1F5EE' },
  PAY:            { past: 'marcado como pago', shortLabel: 'Pagou',  color: '#0F6E56', soft: '#E1F5EE' },
  REFUND:         { past: 'estornado',       shortLabel: 'Estornou',  color: '#854F0B', soft: '#FAEEDA' },
  ADJUST:         { past: 'ajustado',        shortLabel: 'Ajustou',   color: '#854F0B', soft: '#FAEEDA' },
  CONNECT:        { past: 'conectado',       shortLabel: 'Conectou',  color: '#0F6E56', soft: '#E1F5EE' },
  DISCONNECT:     { past: 'desconectado',    shortLabel: 'Desconectou', color: '#5F5E5A', soft: '#F1EFE8' },
  RESTART:        { past: 'reiniciado',      shortLabel: 'Reiniciou', color: '#854F0B', soft: '#FAEEDA' },
}
const FALLBACK: ActionMeta = { past: 'alterado', shortLabel: 'Ação', color: '#5F5E5A', soft: '#F1EFE8' }
const actionMeta = (a?: string): ActionMeta => (a && ACTION_META[a]) || FALLBACK

const pickName = (details: any): string => {
  if (!details || typeof details !== 'object') return ''
  return details.name || details.customerName || details.customer?.name
      || details.description || details.email || details.title || ''
}

const describeAction = (log: any): string => {
  const entity = ENTITY_LABEL[log.entity] || log.entity || 'registro'
  const target = pickName(log.details)
  const ref = log.entityId ? `#${String(log.entityId).padStart(4, '0')}` : ''
  const past = actionMeta(log.action).past
  const a = log.action

  if (a === 'LOGIN')        return `Acesso ao sistema${log.details?.email ? ` — ${log.details.email}` : ''}`
  if (a === 'LOGIN_FAILED') {
    const reason = log.details?.reason === 'invalid_password' ? 'senha incorreta'
                 : log.details?.reason === 'user_not_found' ? 'usuário não encontrado'
                 : 'falha'
    return `Tentativa de login (${reason})${log.details?.email ? ` — ${log.details.email}` : ''}`
  }
  if (a === 'SUSPEND' && log.entity === 'Tenant')  return `Gráfica${ref ? ' ' + ref : ''} suspensa`
  if (a === 'ACTIVATE' && log.entity === 'Tenant') return `Gráfica${ref ? ' ' + ref : ''} reativada`
  if (a === 'CREATE' && log.entity === 'PlatformUser') return `Membro da plataforma adicionado${target ? ` — ${target}` : ''}`
  if (a === 'DELETE' && log.entity === 'PlatformUser') return `Membro da plataforma removido`
  if (a === 'CREATE' && log.entity === 'PlanConfig') return `Plano "${log.details?.name || ''}" criado`
  if (a === 'UPDATE' && log.entity === 'PlanConfig') return `Plano${ref ? ' ' + ref : ''} editado`
  if (a === 'DEACTIVATE' && log.entity === 'PlanConfig') return `Plano${ref ? ' ' + ref : ''} desativado`
  if (a === 'REFUND') {
    const amt = log.details?.amount ? ` de R$ ${Number(log.details.amount).toFixed(2)}` : ''
    return `Pedido${ref ? ' ' + ref : ''} estornado${amt}`
  }
  if (a === 'CONNECT' && log.entity === 'EvolutionInstance')    return 'WhatsApp conectado'
  if (a === 'DISCONNECT' && log.entity === 'EvolutionInstance') return 'WhatsApp desconectado'

  if (target) return `${entity} "${target}" ${past}`
  return `${entity}${ref ? ' ' + ref : ''} ${past}`.trim()
}

const tenantBadgeColor = (slug: string): { bg: string; fg: string } => {
  const palette = [
    { bg: '#EEEDFE', fg: '#3C3489' }, { bg: '#E6F1FB', fg: '#0C447C' },
    { bg: '#EAF3DE', fg: '#3B6D11' }, { bg: '#FAEEDA', fg: '#854F0B' },
    { bg: '#FBEAF0', fg: '#72243E' }, { bg: '#E1F5EE', fg: '#085041' },
  ]
  let h = 0
  for (let i = 0; i < (slug || '').length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return palette[h % palette.length] || { bg: '#F1EFE8', fg: '#444441' }
}
</script>

<template>
  <SidebarLayout>
    <div class="px-6 py-5 max-w-[1400px] mx-auto">
      <!-- Header -->
      <div class="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-slate-900 leading-tight">Auditoria global</h1>
          <p class="text-xs text-slate-500 mt-1">
            <span v-if="total > 0">{{ total }} {{ total === 1 ? 'evento' : 'eventos' }} em todos os tenants</span>
            <span v-else>Eventos sensíveis de toda a plataforma</span>
          </p>
        </div>
        <button @click="fetchLogs" :disabled="loading"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50">
          <svg v-if="!loading" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span v-else class="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></span>
          Atualizar
        </button>
      </div>

      <!-- Filtros -->
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <div class="relative flex-1 max-w-md min-w-[220px]">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="text" placeholder="Buscar por entidade…"
                 class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
        </div>

        <!-- Filtro de tenant — drilldown -->
        <select v-model="tenantFilter"
                class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-slate-400 transition-colors">
          <option value="">Todos os tenants</option>
          <option v-for="t in tenants" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
        </select>

        <input type="date" v-model="startDate"
               class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
        <input type="date" v-model="endDate"
               class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
      </div>

      <!-- Tabs de ação — categorias relevantes pra plataforma -->
      <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
        <button
          v-for="tab in [
            { key: '',             label: 'Todas',       color: '#0F172A', soft: '#F1F5F9' },
            { key: 'LOGIN',        label: 'Acesso',      color: '#534AB7', soft: '#EEEDFE' },
            { key: 'LOGIN_FAILED', label: 'Falha login', color: '#A32D2D', soft: '#FCEBEB' },
            { key: 'SUSPEND',      label: 'Suspensão',   color: '#A32D2D', soft: '#FCEBEB' },
            { key: 'ACTIVATE',     label: 'Ativação',    color: '#0F6E56', soft: '#E1F5EE' },
            { key: 'CREATE',       label: 'Criação',     color: '#1D9E75', soft: '#E1F5EE' },
            { key: 'UPDATE',       label: 'Edição',      color: '#BA7517', soft: '#FAEEDA' },
            { key: 'DELETE',       label: 'Exclusão',    color: '#A32D2D', soft: '#FCEBEB' },
            { key: 'REFUND',       label: 'Estorno',     color: '#854F0B', soft: '#FAEEDA' },
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

      <!-- Lista -->
      <div class="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <!-- Loading -->
        <div v-if="loading && logs.length === 0" class="p-1">
          <div v-for="i in 6" :key="`l${i}`"
               class="grid grid-cols-[150px_140px_180px_110px_1fr] gap-3 items-center py-3 px-4 border-b border-slate-100 last:border-0">
            <div class="h-3 bg-slate-100 rounded animate-pulse w-28"></div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-24"></div>
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-slate-100 animate-pulse"></div>
              <div class="h-3 bg-slate-100 rounded animate-pulse w-20"></div>
            </div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-64"></div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="logs.length === 0" class="flex flex-col items-center justify-center py-14 px-4 text-center">
          <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div class="text-sm font-medium text-slate-900 mb-1">Nenhum evento</div>
          <div class="text-xs text-slate-500 max-w-xs">
            {{ search || actionFilter || tenantFilter || startDate || endDate
               ? 'Nada bate com esses filtros.' : 'Nenhuma ação auditada na plataforma ainda.' }}
          </div>
        </div>

        <!-- Eventos -->
        <div v-else>
          <div class="grid grid-cols-[150px_140px_180px_110px_1fr] gap-3 text-[11px] font-mono text-slate-400 uppercase tracking-wider px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <span>Quando</span>
            <span>Gráfica</span>
            <span>Operador</span>
            <span>Ação</span>
            <span>O que aconteceu</span>
          </div>

          <div v-for="log in logs" :key="log.id"
               class="grid grid-cols-[150px_140px_180px_110px_1fr] gap-3 items-center py-3 px-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-sm">
            <span class="text-xs text-slate-500 whitespace-nowrap">
              {{ log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '—' }}
            </span>

            <!-- Gráfica (tenant) — drilldown click -->
            <button @click="tenantFilter = String(log.tenant?.id || log.tenantId)"
                    class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-transparent hover:border-slate-200 transition-colors min-w-0"
                    :style="{ background: tenantBadgeColor(log.tenant?.slug || '').bg, color: tenantBadgeColor(log.tenant?.slug || '').fg }">
              <span class="w-1 h-1 rounded-full shrink-0" :style="{ background: tenantBadgeColor(log.tenant?.slug || '').fg }"></span>
              <span class="truncate">{{ log.tenant?.name || `#${log.tenantId}` }}</span>
            </button>

            <!-- Operador -->
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium flex items-center justify-center shrink-0">
                {{ initials(log.user?.name || '') }}
              </span>
              <div class="min-w-0">
                <div class="text-slate-900 truncate text-xs">{{ log.user?.name || 'Sistema' }}</div>
                <div v-if="log.user?.userType === 'PLATFORM'" class="text-[10px] font-mono text-violet-600 uppercase tracking-wider leading-none mt-0.5">
                  Platform
                </div>
              </div>
            </div>

            <!-- Ação -->
            <span>
              <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                    :style="{ background: actionMeta(log.action).soft, color: actionMeta(log.action).color }">
                <span class="w-1.5 h-1.5 rounded-full" :style="{ background: actionMeta(log.action).color }"></span>
                {{ actionMeta(log.action).shortLabel }}
              </span>
            </span>

            <!-- O que aconteceu -->
            <div class="text-slate-900 truncate text-sm">{{ describeAction(log) }}</div>
          </div>
        </div>
      </div>

      <!-- Paginação simples -->
      <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 text-xs text-slate-500">
        <span>Página {{ page }} de {{ totalPages }} · {{ total }} eventos</span>
        <div class="flex gap-2">
          <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1 || loading"
                  class="px-3 py-1.5 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors">Anterior</button>
          <button @click="page = Math.min(totalPages, page + 1)" :disabled="page >= totalPages || loading"
                  class="px-3 py-1.5 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors">Próxima</button>
        </div>
      </div>
    </div>
  </SidebarLayout>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; }
</style>
