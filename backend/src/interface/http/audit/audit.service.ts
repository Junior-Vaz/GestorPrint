import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CheckFeatureUseCase } from '../../../application/entitlement/check-feature.usecase';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { PaginationDto, PaginatedResult, paginateResult } from '../../../shared/dto/pagination.dto';

@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    private readonly checkFeature: CheckFeatureUseCase,
  ) {}

  /**
   * Registra uma ação no AuditLog.
   *
   * `userId` é opcional desde a migration que tornou o FK nullable —
   * passe null/undefined pra ações de "sistema" (cron, hook, IA via
   * webhook). Quando o caller tem o userId real (ex: chat ERP autenticado),
   * passe pra rastreabilidade fica precisa.
   */
  async logAction(
    userId: number | null | undefined,
    action: string,
    entity: string,
    entityId: number | undefined,
    details: any,
    tenantId: number,
  ) {
    // tenantId obrigatório — antes tinha default 1 que poluía o tenant da
    // plataforma com audit logs de outros tenants quando o caller esquecia.
    if (typeof tenantId !== 'number') {
      console.error(`logAction sem tenantId: ${action} ${entity}#${entityId}`);
      return;
    }
    try {
      return await (this.prisma.auditLog as any).create({
        data: {
          userId: userId ?? null,
          action,
          entity,
          entityId,
          tenantId,
          details: details ? JSON.parse(JSON.stringify(details)) : null,
        },
      });
    } catch (e: any) {
      // Audit não deve quebrar a operação principal — log e segue.
      console.error('Failed to log audit action:', e?.message || e);
    }
  }

  async findAll(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<any>> {
    await this.checkFeature.execute(tenantId, FeatureKey.AUDIT_LOG);

    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, status: action, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search && search.trim()) {
      where.entity = { contains: search.trim(), mode: 'insensitive' };
    }
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    try {
      const [data, total] = await Promise.all([
        (this.prisma as any).auditLog.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        (this.prisma as any).auditLog.count({ where }),
      ]);

      return paginateResult(data, total, page, limit);
    } catch (err: any) {
      console.error('[AuditService.findAll] query failed:', {
        message: err?.message,
        code: err?.code,
        where,
      });
      return paginateResult([], 0, page, limit);
    }
  }

  async findOne(id: number, tenantId: number) {
    return (this.prisma as any).auditLog.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Variante "global" pra super admin — vê audits de TODOS os tenants.
   * Não roda CheckFeature porque PLATFORM users são isentos de feature gate
   * (não pertencem a um tenant operacional). Anexa nome do tenant em cada
   * registro pra UI conseguir mostrar "Gráfica X · Cliente João editado".
   *
   * Por que NÃO usa Prisma `include: { tenant }`: alguns ambientes têm o
   * AuditLog.tenantId default=1 sem o relation populado se o índice/FK não
   * estiver consistente — dá runtime error genérico. Faço query manual
   * defensiva: busca os logs, depois busca tenants pelos IDs únicos, mescla.
   */
  async findAllPlatform(dto: PaginationDto, tenantFilter?: string): Promise<PaginatedResult<any>> {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, status: action, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tenantFilter) where.tenantId = Number(tenantFilter);
    if (search && search.trim()) {
      where.entity = { contains: search.trim(), mode: 'insensitive' };
    }
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate)   where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    try {
      const [logs, total] = await Promise.all([
        (this.prisma as any).auditLog.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true, role: true, userType: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        (this.prisma as any).auditLog.count({ where }),
      ]);

      // Busca tenants em batch e mescla — evita include problemático.
      const tenantIds = Array.from(new Set(logs.map((l: any) => l.tenantId).filter(Boolean)));
      const tenants = tenantIds.length > 0
        ? await (this.prisma as any).tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true, slug: true },
          })
        : [];
      const tenantMap = new Map(tenants.map((t: any) => [t.id, t]));
      const data = logs.map((l: any) => ({ ...l, tenant: tenantMap.get(l.tenantId) || null }));

      return paginateResult(data, total, page, limit);
    } catch (err: any) {
      // Loga stack completo pra ajudar diagnosticar — mensagem sozinha
      // não diz qual operação Prisma quebrou.
      console.error('[AuditService.findAllPlatform] query failed:', {
        message: err?.message,
        code:    err?.code,
        meta:    err?.meta,
        stack:   err?.stack?.split('\n').slice(0, 5).join('\n'),
        where,
      });
      throw err; // re-lança pra o NestJS retornar 500 com mensagem útil
    }
  }
}
