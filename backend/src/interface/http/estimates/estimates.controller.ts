import { Controller, Get, Post, Body, Patch, Param, Delete, Header, Res, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { EstimatesService } from './estimates.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('estimates')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('estimates')
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  // ─── Public endpoints (no auth) ─────────────────────────────────────────────
  @Public()
  @Get('public/:uuid')
  findPublic(@Param('uuid') uuid: string) {
    return this.estimatesService.findPublicByUuid(uuid);
  }

  @Public()
  @Post('public/:uuid/approve')
  approvePublic(@Param('uuid') uuid: string) {
    return this.estimatesService.approvePublic(uuid);
  }

  @Public()
  @Post('public/:uuid/reject')
  rejectPublic(@Param('uuid') uuid: string, @Body() body: { reason?: string }) {
    return this.estimatesService.rejectPublic(uuid, body.reason || '');
  }

  @Public()
  @Get('public/:uuid/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename=orcamento.pdf')
  async getPublicPdf(@Param('uuid') uuid: string, @Res() res: Response) {
    await this.estimatesService.generatePublicPdf(uuid, res);
  }

  // ─── Endpoints autenticados ─────────────────────────────────────────────────
  @Post()
  @CanAccess('estimates', 'create')
  create(@Body() createEstimateDto: CreateEstimateDto, @CurrentTenant() tenantId: number) {
    return this.estimatesService.create(createEstimateDto, tenantId);
  }

  @Get()
  @CanAccess('estimates', 'view')
  findAll(@CurrentTenant() tenantId: number, @Query() dto: any) {
    return this.estimatesService.findAll(tenantId, dto);
  }

  @Get(':id')
  @CanAccess('estimates', 'view')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.estimatesService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @CanAccess('estimates', 'edit')
  update(@Param('id') id: string, @Body() updateEstimateDto: UpdateEstimateDto, @CurrentTenant() tenantId: number) {
    return this.estimatesService.update(+id, updateEstimateDto, tenantId);
  }

  @Delete(':id')
  @CanAccess('estimates', 'delete')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.estimatesService.remove(+id, tenantId);
  }

  @Post(':id/convert')
  @CanAccess('estimates', 'edit')
  convert(
    @Param('id') id: string,
    @Body() body: { deliveryDate?: string | null; priority?: string } = {},
    @CurrentTenant() tenantId: number,
  ) {
    return this.estimatesService.convertToOrder(+id, tenantId, body);
  }

  @Post(':id/reject')
  @CanAccess('estimates', 'edit')
  reject(@Param('id') id: string, @Body() body: { reason?: string }, @CurrentTenant() tenantId: number) {
    return this.estimatesService.reject(+id, body.reason || '', tenantId);
  }

  @Post(':id/send')
  @CanAccess('estimates', 'edit')
  markSent(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.estimatesService.markSent(+id, tenantId);
  }

  @Post(':id/payment')
  @CanAccess('estimates', 'edit')
  @RequireFeature(FeatureKey.PIX_PAYMENTS)
  getPayment(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.estimatesService.getPayment(+id, tenantId);
  }

  @Get(':id/pdf')
  @CanAccess('estimates', 'view')
  @RequireFeature(FeatureKey.PDF_GENERATION)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=orcamento.pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response, @CurrentTenant() tenantId: number) {
    await this.estimatesService.generatePdf(+id, res, tenantId);
  }
}
