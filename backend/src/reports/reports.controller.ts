import { Controller, Get, Res, Query, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SALES')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@Query('period') period: string, @CurrentTenant() tenantId: number) {
    return this.reportsService.getSummary(period, tenantId);
  }

  @Get('stats')
  getStats(@Query('period') period: string, @CurrentTenant() tenantId: number) {
    return this.reportsService.getStats(period, tenantId);
  }

  @Get('export/csv')
  async exportCsv(@Res() res: Response, @CurrentTenant() tenantId: number) {
    const csv = await this.reportsService.exportTransactionsCsv(tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=fluxo-de-caixa.csv');
    return res.send(csv);
  }

  @Get('export/pdf')
  async exportPdf(@Res() res: Response, @Query('period') period: string, @CurrentTenant() tenantId: number) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-${period || '30d'}.pdf`);
    return this.reportsService.exportDetailedReportPdf(period, res, tenantId);
  }
}
