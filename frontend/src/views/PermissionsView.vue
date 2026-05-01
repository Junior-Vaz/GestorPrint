<script setup lang="ts">
/**
 * Tela admin de RBAC — matriz onde admin define o que cada role (ADMIN, SALES,
 * PRODUCTION) pode fazer em cada resource (telas/módulos).
 *
 * UX é estilo planilha: linhas = resources agrupados por seção, colunas = ações
 * (ver/criar/editar/excluir) por role. Cada checkbox dispara PATCH imediato no
 * backend. "Restaurar padrão" reseta tudo pros defaults sensatos.
 */
import { ref, computed, onMounted } from 'vue'
import { apiFetch, safeJson } from '../utils/api'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { usePermissionsStore } from '../stores/permissions'

const { showToast } = useToast()
const { confirm: confirmDialog } = useConfirm()
const permsStore = usePermissionsStore()

interface Row {
  id: number
  tenantId: number
  role: 'ADMIN' | 'SALES' | 'PRODUCTION'
  resource: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

const rows = ref<Row[]>([])
const loading = ref(true)
const saving = ref<Record<string, boolean>>({})

// Catálogo de resources agrupado pra UI ficar organizada (mesma ordem do menu)
const RESOURCE_GROUPS = [
  { label: 'Visão geral', items: [
    { key: 'home', name: 'Dashboard' },
  ]},
  { label: 'Operação', items: [
    { key: 'pdv', name: 'PDV Balcão' },
    { key: 'estimates', name: 'Orçamentos' },
    { key: 'orders-board', name: 'Produção (Kanban)' },
  ]},
  { label: 'Cadastros', items: [
    { key: 'customers', name: 'Clientes' },
    { key: 'products', name: 'Insumos' },
    { key: 'suppliers', name: 'Fornecedores' },
  ]},
  { label: 'Financeiro', items: [
    { key: 'financial', name: 'Fluxo de Caixa' },
    { key: 'expenses', name: 'Despesas' },
    { key: 'receivables', name: 'Contas a Receber' },
    { key: 'payables', name: 'Contas a Pagar' },
    { key: 'reports', name: 'Relatórios & BI' },
  ]},
  { label: 'Sistema', items: [
    { key: 'users', name: 'Gestão de Equipe' },
    { key: 'settings', name: 'Configurações' },
    { key: 'audit', name: 'Auditoria' },
    { key: 'ai', name: 'Agente de IA' },
  ]},
  { label: 'Loja Online', items: [
    { key: 'ecommerce-dashboard', name: 'Resumo' },
    { key: 'ecommerce-orders', name: 'Pedidos' },
    { key: 'ecommerce-catalog', name: 'Catálogo' },
    { key: 'ecommerce-coupons', name: 'Cupons' },
    { key: 'ecommerce-blog', name: 'Blog' },
    { key: 'ecommerce-site', name: 'Conteúdo do site' },
    { key: 'ecommerce-reviews', name: 'Avaliações' },
    { key: 'ecommerce-settings', name: 'Configurações' },
  ]},
] as const

const ROLES = ['ADMIN', 'SALES', 'PRODUCTION'] as const
const ACTIONS = [
  { key: 'canView',   label: 'Ver',     short: 'V' },
  { key: 'canCreate', label: 'Criar',   short: 'C' },
  { key: 'canEdit',   label: 'Editar',  short: 'E' },
  { key: 'canDelete', label: 'Excluir', short: 'X' },
] as const

// Cores por role pra cabeçalho — segue mesma paleta do UsersView
const ROLE_COLORS: Record<string, { bg: string; fg: string; dot: string }> = {
  ADMIN:      { bg: '#EEEDFE', fg: '#3C3489', dot: '#534AB7' },
  SALES:      { bg: '#E1F5EE', fg: '#0F6E56', dot: '#1D9E75' },
  PRODUCTION: { bg: '#FAEEDA', fg: '#854F0B', dot: '#BA7517' },
}
// Fallback pra roles desconhecidos (TS strict + noUncheckedIndexedAccess força isso —
// `ROLE_COLORS[role]` pode ser undefined teoricamente, mesmo que ROLES seja fixo).
const ROLE_FALLBACK = { bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8' }

// Mapa de busca rápida — { "ADMIN:home": Row, ... }
const lookup = computed(() => {
  const m: Record<string, Row> = {}
  for (const r of rows.value) m[`${r.role}:${r.resource}`] = r
  return m
})

function getRow(role: string, resource: string): Row | null {
  return lookup.value[`${role}:${resource}`] || null
}

async function fetchMatrix() {
  loading.value = true
  try {
    const res = await apiFetch('/api/permissions')
    rows.value = await safeJson(res, [])
  } finally { loading.value = false }
}

async function toggle(role: string, resource: string, field: typeof ACTIONS[number]['key']) {
  const row = getRow(role, resource)
  if (!row) return
  const newValue = !row[field]
  const key = `${role}:${resource}:${field}`
  saving.value[key] = true
  // Otimista — atualiza UI antes da resposta
  ;(row as any)[field] = newValue
  try {
    const res = await apiFetch(`/api/permissions/${role}/${resource}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value: newValue }),
    })
    if (!res.ok) throw new Error('save failed')
    // Atualiza store local SEM refetch — evita reset+load que causaria
    // layout shift na sidebar e scroll reset. Só afeta a UI do admin se
    // ele mexeu na própria role; em outros casos é no-op no store.
    const action = field.replace('can', '').toLowerCase() as 'view' | 'create' | 'edit' | 'delete'
    permsStore.patchLocal(role, resource, action, newValue)
  } catch {
    // Rollback se falhou
    ;(row as any)[field] = !newValue
    showToast('Falha ao salvar permissão', 'error')
  } finally {
    saving.value[key] = false
  }
}

async function resetDefaults() {
  if (!await confirmDialog(
    'Restaurar todas as permissões para o padrão recomendado? Suas customizações serão perdidas.',
    { title: 'Restaurar padrão', confirmLabel: 'Restaurar' },
  )) return
  loading.value = true
  // Preserva o scroll antes de refetch — o `loading=true` esconde a tabela
  // momentaneamente (layout shift) e o browser perde a posição.
  const scrollY = window.scrollY
  try {
    const res = await apiFetch('/api/permissions/reset', { method: 'POST' })
    if (!res.ok) throw new Error()
    await fetchMatrix()
    permsStore.reset()
    await permsStore.load()
    showToast('Permissões restauradas para o padrão', 'success')
  } catch {
    showToast('Falha ao restaurar', 'error')
  } finally {
    loading.value = false
    // Restaura scroll após o DOM repintar (próximo tick)
    requestAnimationFrame(() => window.scrollTo(0, scrollY))
  }
}

onMounted(fetchMatrix)
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">
      <!-- Header -->
      <div class="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 class="text-xl font-medium text-slate-900">Controle de acesso</h1>
          <p class="text-sm text-slate-500 mt-1">
            Defina o que cada função pode fazer em cada tela do sistema.
            Mudanças se aplicam imediatamente aos usuários online.
          </p>
        </div>
        <button @click="resetDefaults" :disabled="loading"
          class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-full px-4 py-1.5 transition-colors">
          Restaurar padrão
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>

      <!-- Matriz -->
      <div v-else class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <th class="px-4 py-3 text-left font-medium sticky left-0 bg-slate-50 z-10">Tela / Recurso</th>
                <th v-for="role in ROLES" :key="role" :colspan="ACTIONS.length"
                  class="px-3 py-2 text-center border-l border-slate-200">
                  <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full"
                    :style="{ background: (ROLE_COLORS[role] ?? ROLE_FALLBACK).bg, color: (ROLE_COLORS[role] ?? ROLE_FALLBACK).fg }">
                    <span class="w-1.5 h-1.5 rounded-full" :style="{ background: (ROLE_COLORS[role] ?? ROLE_FALLBACK).dot }"></span>
                    {{ role === 'ADMIN' ? 'Admin' : role === 'SALES' ? 'Vendas' : 'Produção' }}
                  </span>
                </th>
              </tr>
              <tr class="border-b border-slate-200 bg-slate-50/60 text-[10px] text-slate-400">
                <th class="px-4 py-2 sticky left-0 bg-slate-50/60 z-10"></th>
                <template v-for="role in ROLES" :key="role">
                  <th v-for="a in ACTIONS" :key="a.key"
                    class="px-2 py-2 text-center font-normal" :title="a.label">
                    {{ a.label }}
                  </th>
                </template>
              </tr>
            </thead>
            <tbody>
              <template v-for="group in RESOURCE_GROUPS" :key="group.label">
                <!-- Group header -->
                <tr class="bg-slate-50/40 text-[10px] uppercase tracking-wider text-slate-400 border-y border-slate-100">
                  <td class="px-4 py-1.5 font-medium sticky left-0 bg-slate-50/40 z-10" :colspan="1 + ROLES.length * ACTIONS.length">
                    {{ group.label }}
                  </td>
                </tr>
                <!-- Resource rows -->
                <tr v-for="item in group.items" :key="item.key"
                  class="border-b border-slate-100 last:border-0 hover:bg-slate-50/40 transition-colors">
                  <td class="px-4 py-2.5 text-slate-700 sticky left-0 bg-white z-10">
                    {{ item.name }}
                    <span class="text-[10px] text-slate-400 font-mono ml-1">{{ item.key }}</span>
                  </td>
                  <template v-for="role in ROLES" :key="`${role}-${item.key}`">
                    <td v-for="a in ACTIONS" :key="`${role}-${item.key}-${a.key}`"
                      class="px-2 py-2.5 text-center border-l border-slate-100">
                      <!-- Button puro em vez de <label><input sr-only> — o input
                           absoluto causava scroll-into-view automático ao receber
                           foco, jogando a página pro topo a cada click. Button
                           inline com aria-pressed mantém acessibilidade. -->
                      <button type="button"
                        :aria-pressed="getRow(role, item.key)?.[a.key] || false"
                        :aria-label="`${a.label} ${item.name} para ${role}`"
                        :disabled="!!saving[`${role}:${item.key}:${a.key}`]"
                        @click="toggle(role, item.key, a.key)"
                        :class="[
                          'w-4 h-4 rounded border transition-colors flex items-center justify-center mx-auto cursor-pointer',
                          getRow(role, item.key)?.[a.key]
                            ? 'bg-slate-900 border-slate-900'
                            : 'border-slate-300 hover:border-slate-400 bg-white',
                          saving[`${role}:${item.key}:${a.key}`] ? 'opacity-50 cursor-wait' : '',
                        ]">
                        <svg v-if="getRow(role, item.key)?.[a.key]"
                          class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      </button>
                    </td>
                  </template>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Avisos -->
      <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        <strong>Atenção:</strong> ADMIN deve manter acesso total à tela "Configurações" e "Gestão de Equipe" —
        senão você pode perder o controle do sistema. Mudanças aplicam ao próximo carregamento de página dos
        usuários online.
      </div>
    </div>
  </div>
</template>
