import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePlanStore } from './plan'

/**
 * Mapa centralizado de tab → feature que deve estar ativa pra acessar.
 * Toda chamada de `setTab` passa por essa checagem — então mesmo se algum
 * botão em alguma view chamar `ui.setTab('reports')` direto sem checar plan,
 * a navegação é bloqueada e o usuário vê o toast de upgrade.
 *
 * Tabs ausentes daqui são consideradas "sempre disponíveis" (Dashboard, PDV,
 * Clientes, Insumos, Fornecedores, Fluxo de Caixa, Despesas, Configs, etc).
 */
const TAB_FEATURE_MAP: Record<string, { feature: string; label: string }> = {
  // Operação
  'board':                  { feature: 'hasKanban',             label: 'Fila de Produção' },
  // Financeiro
  'receivables':            { feature: 'hasReceivables',        label: 'Contas a Receber' },
  'payables':               { feature: 'hasReceivables',        label: 'Contas a Pagar' },
  // Análises
  'reports':                { feature: 'hasReports',            label: 'Relatórios & BI' },
  'ai':                     { feature: 'hasWhatsapp',           label: 'Agente de IA' },
  // Sistema
  'audit':                  { feature: 'hasAudit',              label: 'Auditoria' },
  // Orçamentos por tipo
  'estimates-plotter':      { feature: 'hasPlotterEstimate',    label: 'Orçamento de plotter' },
  'estimates-cutting':      { feature: 'hasCuttingEstimate',    label: 'Orçamento de recorte' },
  'estimates-embroidery':   { feature: 'hasEmbroideryEstimate', label: 'Orçamento de estamparia' },
  // Ecommerce — agrupado, todos exigem a mesma feature
  'ecommerce-catalog':      { feature: 'hasEcommerce',          label: 'Catálogo da loja' },
  'ecommerce-orders':       { feature: 'hasEcommerce',          label: 'Pedidos da loja' },
  'ecommerce-reviews':      { feature: 'hasEcommerce',          label: 'Avaliações da loja' },
  'ecommerce-coupons':      { feature: 'hasEcommerce',          label: 'Cupons' },
  'ecommerce-blog':         { feature: 'hasEcommerce',          label: 'Blog' },
  'ecommerce-site':         { feature: 'hasEcommerce',          label: 'Conteúdo do site' },
  'ecommerce-settings':     { feature: 'hasEcommerce',          label: 'Configurações da loja' },
}

export const useUiStore = defineStore('ui', () => {
  const currentTab = ref('home')
  const editingEstimate = ref<any>(null)

  const ESTIMATE_TABS = ['calculator', 'estimates-service', 'estimates-plotter', 'estimates-cutting', 'estimates-embroidery']

  /**
   * Troca de aba com gate central de feature.
   * Bloqueia silenciosamente (toast via plan.setLimitError) quando feature
   * não está disponível — não muda `currentTab`, então a tela continua na atual.
   */
  const setTab = (tab: string, data: any = null) => {
    const gate = TAB_FEATURE_MAP[tab]
    if (gate) {
      const plan = usePlanStore()
      const allowed = (plan as any)[gate.feature] === true
      if (!allowed) {
        plan.setLimitError(`${gate.label} não está disponível no plano atual.`)
        return
      }
    }
    currentTab.value = tab
    if (ESTIMATE_TABS.includes(tab)) {
      editingEstimate.value = data || null
    }
  }

  return {
    currentTab,
    editingEstimate,
    setTab,
  }
})
