import { Controller, Get, Res, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';

@ApiTags('reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @CanAccess('reports', 'view')
  getSummary(
    @Query('period') period: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenant() tenantId: number,
  ) {
    return this.reportsService.getSummary(period, tenantId, { startDate, endDate });
  }

  @Get('stats')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  @CanAccess('reports', 'view')
  getStats(@Query('period') period: string, @CurrentTenant() tenantId: number) {
    return this.reportsService.getStats(period, tenantId);
  }

  @Get('export/csv')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  @CanAccess('reports', 'view')
  async exportCsv(@Res() res: Response, @CurrentTenant() tenantId: number) {
    const csv = await this.reportsService.exportTransactionsCsv(tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=fluxo-de-caixa.csv');
    return res.send(csv);
  }

  @Get('export/pdf')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  @CanAccess('reports', 'view')
  async exportPdf(@Res() res: Response, @Query('period') period: string, @CurrentTenant() tenantId: number) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-${period || '30d'}.pdf`);
    return this.reportsService.exportDetailedReportPdf(period, res, tenantId);
  }

  @Get('export/xlsx')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  @CanAccess('reports', 'view')
  async exportXlsx(@Res() res: Response, @Query('period') period: string, @CurrentTenant() tenantId: number) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=fluxo-de-caixa-${period || '30d'}.xlsx`);
    return this.reportsService.exportTransactionsXlsx(period, res, tenantId);
  }

  @Get('export/sales/xlsx')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  @CanAccess('reports', 'view')
  async exportSalesXlsx(
    @Res() res: Response,
    @Query('period') period: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenant() tenantId: number,
  ) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-vendas-${period || '30d'}.xlsx`);
    return this.reportsService.exportSalesXlsx(res, tenantId, { period, startDate, endDate });
  }

  @Get('export/production/xlsx')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  @CanAccess('reports', 'view')
  async exportProductionXlsx(
    @Res() res: Response,
    @Query('period') period: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenant() tenantId: number,
  ) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-producao-${period || '30d'}.xlsx`);
    return this.reportsService.exportProductionXlsx(res, tenantId, { period, startDate, endDate });
  }

  @Get('advanced')
  @RequireFeature(FeatureKey.FINANCIAL_REPORTS)
  @CanAccess('reports', 'view')
  getAdvanced(
    @CurrentTenant() tenantId: number,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getAdvanced(tenantId, { period, startDate, endDate });
  }
}
