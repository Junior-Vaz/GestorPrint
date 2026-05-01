/**
 * FeatureKey — enum canônico de todas as features do sistema.
 *
 * Mapeia 1:1 com o enum FeatureKey do Prisma schema.
 * Centralizar aqui evita magic strings espalhadas pelo código.
 *
 * Como adicionar uma nova feature:
 *  1. Adicionar valor neste enum
 *  2. Adicionar no enum FeatureKey do schema.prisma
 *  3. Adicionar campo boolean no PlanConfig (retrocompatibilidade)
 *  4. Usar @RequireFeature(FeatureKey.NOVA_FEATURE) no controller
 */
export enum FeatureKey {
  // ── Operacionais ────────────────────────────────────────────────────────────
  PDF_GENERATION = 'PDF_GENERATION',
  FINANCIAL_REPORTS = 'FINANCIAL_REPORTS',
  KANBAN_BOARD = 'KANBAN_BOARD',
  FILE_UPLOAD = 'FILE_UPLOAD',

  // ── Integrações ──────────────────────────────────────────────────────────────
  WHATSAPP_AI = 'WHATSAPP_AI',
  PIX_PAYMENTS = 'PIX_PAYMENTS',

  // ── Tipos de Orçamento ────────────────────────────────────────────────────────
  PLOTTER_ESTIMATE = 'PLOTTER_ESTIMATE',
  CUTTING_ESTIMATE = 'CUTTING_ESTIMATE',
  EMBROIDERY_ESTIMATE = 'EMBROIDERY_ESTIMATE',

  // ── Gestão Avançada ───────────────────────────────────────────────────────────
  AUDIT_LOG = 'AUDIT_LOG',
  COMMISSIONS = 'COMMISSIONS',
  API_ACCESS = 'API_ACCESS',
  RECEIVABLES = 'RECEIVABLES',

  // ── Ecommerce / Loja online ──────────────────────────────────────────────────
  ECOMMERCE = 'ECOMMERCE',
  MP_CARD = 'MP_CARD',
  MELHOR_ENVIOS = 'MELHOR_ENVIOS',

  // ── Programa de Fidelidade ──────────────────────────────────────────────────
  // Pontos por compra, cashback, tiers, cupom de aniversário automático, indicação.
  // Default ON em BASIC+. Cobrir UI, hooks de Order, cron de expiração e seção de
  // configuração no Settings + tela do SaaS Admin.
  LOYALTY_PROGRAM = 'LOYALTY_PROGRAM',
}

/**
 * Mapeamento entre FeatureKey e o campo booleano correspondente no PlanConfig.
 * Permite que o domínio traduza a feature sem conhecer detalhes de infraestrutura.
 */
export const FEATURE_TO_PLAN_FIELD: Record<FeatureKey, string> = {
  [FeatureKey.PDF_GENERATION]: 'hasPdf',
  [FeatureKey.FINANCIAL_REPORTS]: 'hasReports',
  [FeatureKey.KANBAN_BOARD]: 'hasKanban',
  [FeatureKey.FILE_UPLOAD]: 'hasFileUpload',
  [FeatureKey.WHATSAPP_AI]: 'hasWhatsapp',
  [FeatureKey.PIX_PAYMENTS]: 'hasPix',
  [FeatureKey.PLOTTER_ESTIMATE]: 'hasPlotterEstimate',
  [FeatureKey.CUTTING_ESTIMATE]: 'hasCuttingEstimate',
  [FeatureKey.EMBROIDERY_ESTIMATE]: 'hasEmbroideryEstimate',
  [FeatureKey.AUDIT_LOG]: 'hasAudit',
  [FeatureKey.COMMISSIONS]: 'hasCommissions',
  [FeatureKey.API_ACCESS]: 'hasApiAccess',
  [FeatureKey.RECEIVABLES]: 'hasReceivables',
  [FeatureKey.ECOMMERCE]: 'hasEcommerce',
  [FeatureKey.MP_CARD]: 'hasMpCard',
  [FeatureKey.MELHOR_ENVIOS]: 'hasMelhorEnvios',
  [FeatureKey.LOYALTY_PROGRAM]: 'hasLoyalty',
};
