import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { EcommerceService } from './ecommerce.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Resolução de tenant pela hospedagem da SPA.
 *
 * Fluxo:
 *   1. SPA inicializa
 *   2. Faz GET /api/ecommerce/resolve-tenant?host=loja.cliente.com.br
 *   3. Backend procura Tenant.storeDomain matching e retorna tenantId
 *   4. SPA cacheia em memória e usa esse tenantId em todas as requests subsequentes
 *
 * Sem fallback intencional. Se o domínio não for cadastrado no ERP, a SPA mostra
 * tela de erro — evita cair silenciosamente em outro tenant.
 */
@Public()
@Controller('ecommerce')
export class TenantResolverPublicController {
  constructor(private readonly svc: EcommerceService) {}

  // Rate limit defensivo: o endpoint é chamado uma vez por carga da SPA, mas é público.
  // 60/min é folgado pra usuários reais (refresh agressivo) e barra scrappers.
  @Throttle({ short: { ttl: 60_000, limit: 60 } })
  @Get('resolve-tenant')
  async resolve(@Query('host') host?: string) {
    if (!host) throw new BadRequestException('host obrigatório');
    const result = await this.svc.resolveTenantByDomain(host);
    if (!result) {
      throw new NotFoundException('Loja não encontrada para esse domínio');
    }
    return result;
  }
}

/**
 * Admin do ERP gerencia o storeDomain do próprio tenant.
 * Fica em /ecommerce/admin/domain — agrupa com os demais admins do ecommerce.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireFeature(FeatureKey.ECOMMERCE)
@Controller('ecommerce/admin')
export class TenantDomainAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('domain')
  @CanAccess('ecommerce-settings', 'view')
  async getDomain(@CurrentTenant() tenantId: number) {
    const t = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { storeDomain: true },
    });
    return { storeDomain: t?.storeDomain || '' };
  }

  /**
   * Atualiza o domínio da loja. Aceita string vazia (= remove o domínio).
   * Normaliza pra lowercase e remove protocolo/path se o admin colar URL completa.
   */
  @Patch('domain')
  @CanAccess('ecommerce-settings', 'edit')
  async updateDomain(
    @CurrentTenant() tenantId: number,
    @Body() body: { storeDomain?: string },
  ) {
    const raw = (body?.storeDomain ?? '').trim();
    let normalized: string | null = null;

    if (raw) {
      // Remove protocolo + caminho se vier URL completa colada do navegador
      let clean = raw.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
      if (!clean) {
        throw new BadRequestException('Domínio inválido');
      }
      // Validação básica — letras, números, pontos, hífens, dois-pontos (porta) só
      if (!/^[a-z0-9.\-:]+$/.test(clean)) {
        throw new BadRequestException('Domínio contém caracteres inválidos');
      }
      normalized = clean;

      // Garante unicidade — se outro tenant já tem esse domínio, recusa
      const conflict = await (this.prisma as any).tenant.findFirst({
        where: { storeDomain: normalized, NOT: { id: tenantId } },
        select: { id: true },
      });
      if (conflict) {
        throw new BadRequestException('Esse domínio já está em uso por outra loja');
      }
    }

    await (this.prisma as any).tenant.update({
      where: { id: tenantId },
      data:  { storeDomain: normalized },
    });
    return { storeDomain: normalized || '' };
  }
}
