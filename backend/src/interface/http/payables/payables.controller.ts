import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PayablesService } from './payables.service';
import { CreatePayableDto } from './dto/create-payable.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { PayPayableDto } from './dto/pay-payable.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

@ApiTags('payables')
@UseGuards(JwtAuthGuard)
@RequireFeature(FeatureKey.RECEIVABLES)
@Controller('payables')
export class PayablesController {
  constructor(private readonly payablesService: PayablesService) {}

  @Post()
  @CanAccess('payables', 'create')
  create(@Body() dto: CreatePayableDto, @CurrentTenant() tenantId: number) {
    return this.payablesService.create(dto, tenantId);
  }

  @Get()
  @CanAccess('payables', 'view')
  findAll(@CurrentTenant() tenantId: number, @Query() dto: PaginationDto) {
    return this.payablesService.findAll(tenantId, dto);
  }

  // ATENÇÃO: /totals deve vir ANTES de /:id para não ser parseado como id
  @Get('totals')
  @CanAccess('payables', 'view')
  getTotals(@CurrentTenant() tenantId: number) {
    return this.payablesService.getTotals(tenantId);
  }

  @Get(':id')
  @CanAccess('payables', 'view')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.payablesService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @CanAccess('payables', 'edit')
  update(@Param('id') id: string, @Body() dto: UpdatePayableDto, @CurrentTenant() tenantId: number) {
    return this.payablesService.update(+id, dto, tenantId);
  }

  @Post(':id/pay')
  @CanAccess('payables', 'edit')
  pay(@Param('id') id: string, @Body() dto: PayPayableDto, @CurrentTenant() tenantId: number) {
    return this.payablesService.markAsPaid(+id, dto, tenantId);
  }

  @Post(':id/cancel')
  @CanAccess('payables', 'edit')
  cancel(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.payablesService.cancel(+id, tenantId);
  }

  @Delete(':id')
  @CanAccess('payables', 'delete')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.payablesService.remove(+id, tenantId);
  }
}
