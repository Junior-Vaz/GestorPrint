/**
 * Pinia store de permissões — carrega a matriz consolidada do user logado
 * uma vez no boot e expõe helpers reativos `can.view/create/edit/delete()`.
 *
 * Backend: GET /api/permissions/me
 *   → { role, permissions: { home: { view, create, edit, delete }, ... } }
 *
 * Super admin recebe `permissions: 'all'` e o store libera tudo.
 *
 * Fail-open vs fail-closed: enquanto carrega, retornamos `false` (fail-closed)
 * pra evitar flash de telas que o user não deveria ver. Componentes que
 * precisam mostrar algo durante loading devem checar `loading.value`.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch, safeJson } from '../utils/api'

type Action = 'view' | 'create' | 'edit' | 'delete'
type ResourcePerms = Record<Action, boolean>

export const usePermissionsStore = defineStore('permissions', () => {
  const role = ref<string>('')
  const isSuperAdmin = ref(false)
  const matrix = ref<Record<string, ResourcePerms>>({})
  const loading = ref(true)
  const loaded  = ref(false)

  /** Carrega permissões do backend. Idempotente — múltiplas chamadas reusam. */
  async function load() {
    if (loaded.value) return
    loading.value = true
    try {
      const res = await apiFetch('/api/permissions/me', { silentOn403: true })
      if (!res.ok) {
        // Sem token / falha — deixa matrix vazia (fail-closed)
        loaded.value = true
        return
      }
      const data: any = await safeJson(res, {})
      role.value = data.role || ''
      isSuperAdmin.value = !!data.superAdmin
      matrix.value = data.permissions === 'all' || data.superAdmin
        ? {}   // super admin: matrix vazia + flag → tudo liberado
        : (data.permissions || {})
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  /** Reset ao logout — força recarregar na próxima sessão. */
  function reset() {
    role.value = ''
    isSuperAdmin.value = false
    matrix.value = {}
    loaded.value = false
    loading.value = true
  }

  /**
   * Atualiza a matriz local sem refetch — usado quando o admin altera a
   * própria role na tela de Permissões. Evita layout shift / scroll reset
   * que aconteceria com reset()+load() (loaded=false momentâneo dispara
   * fallbacks em todas as computeds da sidebar).
   *
   * Se o role afetado não é o do user logado, é no-op (não afeta UI dele).
   */
  function patchLocal(targetRole: string, resource: string, action: Action, value: boolean) {
    if (targetRole !== role.value) return
    if (!matrix.value[resource]) {
      matrix.value[resource] = { view: false, create: false, edit: false, delete: false }
    }
    matrix.value[resource][action] = value
  }

  /** Verifica permissão específica. Reativo.
   *  Estratégia de fallback enquanto a matriz não carregou: usa role-based
   *  defaults equivalentes aos hardcoded antigos. Evita flash de menu vazio
   *  no boot da app. Quando matriz carrega, sobrescreve. */
  function check(resource: string, action: Action): boolean {
    if (isSuperAdmin.value) return true
    if (!loaded.value) return fallbackByRole(resource, action)
    return matrix.value[resource]?.[action] === true
  }

  /** Defaults conservadores derivados do role enquanto a matriz não carregou.
   *  Espelham o comportamento legacy (auth.isAdmin/isSales/isProduction). */
  function fallbackByRole(resource: string, action: Action): boolean {
    const userRole = role.value || JSON.parse(localStorage.getItem('gp_user') || '{}')?.role
    if (!userRole) return false
    if (userRole === 'ADMIN') return true   // admin sempre podia tudo
    if (action !== 'view') return false      // outras ações: fail-closed
    if (userRole === 'SALES') {
      return ['home', 'pdv', 'estimates', 'orders-board', 'customers', 'products',
              'financial', 'receivables',
              'ecommerce-dashboard', 'ecommerce-orders', 'ecommerce-catalog',
              'ecommerce-reviews'].includes(resource)
    }
    if (userRole === 'PRODUCTION') {
      return ['home', 'orders-board', 'products', 'ecommerce-orders'].includes(resource)
    }
    return false
  }

  // Helpers convenientes pra usar em templates
  const can = {
    view:   (resource: string) => check(resource, 'view'),
    create: (resource: string) => check(resource, 'create'),
    edit:   (resource: string) => check(resource, 'edit'),
    delete: (resource: string) => check(resource, 'delete'),
  }

  // Computeds reativos comuns — usar quando precisar reatividade automática
  // (ex: v-if no template recalcula quando matriz carrega)
  const canSee = computed(() => (resource: string) => check(resource, 'view'))

  return { role, isSuperAdmin, matrix, loading, loaded, load, reset, patchLocal, check, can, canSee }
})
