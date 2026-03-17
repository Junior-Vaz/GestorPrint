import { Controller, Get, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@Query('period') period?: string) {
    return this.reportsService.getSummary(period);
  }

  @Get('stats')
  getStats(@Query('period') period?: string) {
    return this.reportsService.getStats(period);
  }

  @Get('export/csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.reportsService.exportTransactionsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=fluxo-de-caixa.csv');
    return res.send(csv);
  }

  @Get('export/pdf')
  async exportPdf(@Res() res: Response, @Query('period') period?: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-${period || '30d'}.pdf`);
    return this.reportsService.exportDetailedReportPdf(period, res);
  }
}
