import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { FeatureKey } from '../../domain/entitlement/feature-key.enum';
import { BlockReason } from '../../domain/entitlement/entitlement.entity';
import {
  IEntitlementRepository,
  ENTITLEMENT_REPOSITORY,
} from './entitlement-repository.interface';

/**
 * CheckFeatureUseCase — A única fonte de verdade para autorização de features.
 *
 * Todos os outros Use Cases e Guards delegam para cá.
 * Nunca duplicar esta lógica em services individuais.
 */
@Injectable()
export class CheckFeatureUseCase {
  constructor(
    @Inject(ENTITLEMENT_REPOSITORY)
    private readonly entitlementRepo: IEntitlementRepository,
  ) {}

  /**
   * Verifica se o tenant pode usar a feature.
   * Lança ForbiddenException com mensagem apropriada se não puder.
   */
  async execute(tenantId: number, feature: FeatureKey): Promise<void> {
    const entitlement = await this.entitlementRepo.findByTenantId(tenantId);

    if (entitlement.can(feature)) return;

    const reason = entitlement.explainBlock(feature);
    throw new ForbiddenException(this.buildMessage(reason, feature));
  }

  /**
   * Versão que retorna boolean — para quando o caller quer decidir o que fazer.
   * Não lança exceção.
   */
  async check(tenantId: number, feature: FeatureKey): Promise<boolean> {
    const entitlement = await this.entitlementRepo.findByTenantId(tenantId);
    return entitlement.can(feature);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildMessage(reason: BlockReason, feature: FeatureKey): string {
    switch (reason) {
      case BlockReason.TENANT_SUSPENDED:
        return 'Sua conta está suspensa ou cancelada. Entre em contato com o suporte.';
      case BlockReason.PLAN_UPGRADE_REQUIRED:
        return `O recurso "${this.humanize(feature)}" não está disponível no seu plano atual. Faça upgrade para continuar.`;
      case BlockReason.OVERRIDE_BLOCKED:
        return `O acesso ao recurso "${this.humanize(feature)}" foi bloqueado pelo administrador.`;
      default:
        return 'Acesso negado.';
    }
  }

  private humanize(feature: FeatureKey): string {
    const labels: Record<FeatureKey, string> = {
      [FeatureKey.PDF_GENERATION]: 'Geração de PDF',
      [FeatureKey.FINANCIAL_REPORTS]: 'Relatórios Financeiros',
      [FeatureKey.KANBAN_BOARD]: 'Fila de Produção (Kanban)',
      [FeatureKey.FILE_UPLOAD]: 'Upload de Arquivos Gráficos',
      [FeatureKey.WHATSAPP_AI]: 'WhatsApp AI',
      [FeatureKey.PIX_PAYMENTS]: 'Pagamentos PIX',
      [FeatureKey.PLOTTER_ESTIMATE]: 'Orçamento de Impressão Plotter',
      [FeatureKey.CUTTING_ESTIMATE]: 'Orçamento de Recorte',
      [FeatureKey.EMBROIDERY_ESTIMATE]: 'Orçamento de Estamparia',
      [FeatureKey.AUDIT_LOG]: 'Log de Auditoria',
      [FeatureKey.COMMISSIONS]: 'Controle de Comissões',
      [FeatureKey.API_ACCESS]: 'Acesso à API',
      [FeatureKey.RECEIVABLES]: 'Contas a Receber / Pagar',
      [FeatureKey.ECOMMERCE]: 'Loja Online (Ecommerce)',
      [FeatureKey.MP_CARD]: 'Cartão Mercado Pago',
      [FeatureKey.MELHOR_ENVIOS]: 'Frete Melhor Envios',
      [FeatureKey.LOYALTY_PROGRAM]: 'Programa de Fidelidade',
    };
    return labels[feature] ?? feature;
  }
}
