import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

@ApiTags('audit')
@ApiBearerAuth('JWT')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

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
