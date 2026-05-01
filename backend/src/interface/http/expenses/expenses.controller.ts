import { Controller, Get, Post, Body, Patch, Param, Delete, Res, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

@ApiTags('expenses')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @CanAccess('expenses', 'create')
  create(@Body() createExpenseDto: CreateExpenseDto, @CurrentTenant() tenantId: number) {
    return this.expensesService.create(createExpenseDto, tenantId);
  }

  @Get()
  @CanAccess('expenses', 'view')
  findAll(@CurrentTenant() tenantId: number, @Query() dto: PaginationDto) {
    return this.expensesService.findAll(tenantId, dto);
  }

  @Patch(':id')
  @CanAccess('expenses', 'edit')
  update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto, @CurrentTenant() tenantId: number) {
    return this.expensesService.update(+id, updateExpenseDto, tenantId);
  }

  // Exportações exigem feature de Relatórios — gateado pra ambos formatos
  @Get('export/csv')
  @CanAccess('expenses', 'view')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  async exportCsv(@Res() res: Response, @CurrentTenant() tenantId: number) {
    const csv = await this.expensesService.exportCsv(tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=despesas.csv');
    return res.send(csv);
  }

  @Get('export/xlsx')
  @CanAccess('expenses', 'view')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  async exportXlsx(@Res() res: Response, @CurrentTenant() tenantId: number) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=despesas.xlsx');
    return this.expensesService.exportXlsx(res, tenantId);
  }

  @Delete(':id')
  @CanAccess('expenses', 'delete')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.expensesService.remove(+id, tenantId);
  }

  @Get('categories')
  @CanAccess('expenses', 'view')
  findAllCategories(@CurrentTenant() tenantId: number) {
    return this.expensesService.findAllCategories(tenantId);
  }

  @Post('categories')
  @CanAccess('expenses', 'create')
  createCategory(@Body() body: { name: string }, @CurrentTenant() tenantId: number) {
    return this.expensesService.createCategory(body.name, tenantId);
  }

  @Delete('categories/:id')
  @CanAccess('expenses', 'delete')
  removeCategory(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.expensesService.removeCategory(+id, tenantId);
  }
}
