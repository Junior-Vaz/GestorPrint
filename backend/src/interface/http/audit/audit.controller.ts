import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PlatformOnlyGuard } from '../platform-users/platform-only.guard';

/**
 * DTO específico do endpoint /audit/platform — estende PaginationDto pra
 * aceitar `tenantId` opcional como filtro adicional. Necessário porque o
 * ValidationPipe global tem `forbidNonWhitelisted: true` e rejeitaria o
 * tenantId como query param "estranho" se viesse só via @Query('tenantId').
 */
class PlatformAuditQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  tenantId?: string;
}

@ApiTags('audit')
@ApiBearerAuth('JWT')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/audit/platform — endpoint exclusivo do SaaS Admin Panel.
   * Lista audits de TODOS os tenants (sem filtro pelo tenantId do JWT).
   * Suporta `?tenantId=X` pra drilldown num tenant específico.
   *
   * Declarado ANTES de `:id` pra que o router não case "platform" como id.
   */
  @Get('platform')
  @UseGuards(PlatformOnlyGuard)
  findAllPlatform(@Query() dto: PlatformAuditQueryDto) {
    return this.auditService.findAllPlatform(dto, dto.tenantId);
  }

  @Get()
  @RequireFeature(FeatureKey.AUDIT_LOG)
  @CanAccess('audit', 'view')
  findAll(@CurrentTenant() tenantId: number, @Query() dto: PaginationDto) {
    return this.auditService.findAll(tenantId, dto);
  }

  @Get(':id')
  @RequireFeature(FeatureKey.AUDIT_LOG)
  @CanAccess('audit', 'view')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.auditService.findOne(+id, tenantId);
  }
}
