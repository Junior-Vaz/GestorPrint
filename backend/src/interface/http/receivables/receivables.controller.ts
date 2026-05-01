import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReceivablesService } from './receivables.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { UpdateReceivableDto } from './dto/update-receivable.dto';
import { PayReceivableDto } from './dto/pay-receivable.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

@ApiTags('receivables')
@UseGuards(JwtAuthGuard)
@RequireFeature(FeatureKey.RECEIVABLES)
@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Post()
  @CanAccess('receivables', 'create')
  create(@Body() dto: CreateReceivableDto, @CurrentTenant() tenantId: number) {
    return this.receivablesService.create(dto, tenantId);
  }

  @Get()
  @CanAccess('receivables', 'view')
  findAll(@CurrentTenant() tenantId: number, @Query() dto: PaginationDto) {
    return this.receivablesService.findAll(tenantId, dto);
  }

  // ATENÇÃO: /totals deve vir ANTES de /:id para não ser parseado como id
  @Get('totals')
  @CanAccess('receivables', 'view')
  getTotals(@CurrentTenant() tenantId: number) {
    return this.receivablesService.getTotals(tenantId);
  }

  @Get(':id')
  @CanAccess('receivables', 'view')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.receivablesService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @CanAccess('receivables', 'edit')
  update(@Param('id') id: string, @Body() dto: UpdateReceivableDto, @CurrentTenant() tenantId: number) {
    return this.receivablesService.update(+id, dto, tenantId);
  }

  @Post(':id/pay')
  @CanAccess('receivables', 'edit')
  pay(@Param('id') id: string, @Body() dto: PayReceivableDto, @CurrentTenant() tenantId: number) {
    return this.receivablesService.markAsPaid(+id, dto, tenantId);
  }

  @Post(':id/cancel')
  @CanAccess('receivables', 'edit')
  cancel(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.receivablesService.cancel(+id, tenantId);
  }

  @Delete(':id')
  @CanAccess('receivables', 'delete')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.receivablesService.remove(+id, tenantId);
  }
}
