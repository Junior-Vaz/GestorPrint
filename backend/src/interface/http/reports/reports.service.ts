import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CheckFeatureUseCase } from '../../../application/entitlement/check-feature.usecase';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private readonly checkFeature: CheckFeatureUseCase,
  ) {}

  async getSummary(
    period = '30d',
    tenantId = 1,
    opts: { startDate?: string; endDate?: string } = {},
  ) {
    // No feature gate here — summary is used by the dashboard (available to all plans)
    try {
      const dateFilter = opts.startDate
        ? new Date(`${opts.startDate}T00:00:00.000Z`)
        : this.getDateFilter(period);
      const endFilter = opts.endDate
        ? new Date(`${opts.endDate}T23:59:59.999Z`)
        : undefined;
      // Nota: deixo endFilter como undefined por padrão pra manter comportamento
      // antigo (sem limite superior → até agora).
      const dateRange: any = endFilter
        ? { gte: dateFilter, lte: endFilter }
        : { gte: dateFilter };

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [
        revenueAgg, revenueTodayAgg, revenueMonthAgg, txCount,
        expensesAgg,
        orderStatusGroups,
        inventoryAgg, lowStockRaw,
        invoiceAgg, billAgg,
      ] = await Promise.all([
        (this.prisma as any).transaction.aggregate({
          where: { status: 'PAID', createdAt: dateRange, order: { tenantId } },
          _sum: { amount: true }, _count: true,
        }),
        (this.prisma as any).transaction.aggregate({
          where: { status: 'PAID', createdAt: { gte: todayStart }, order: { tenantId } },
          _sum: { amount: true },
        }),
        (this.prisma as any).transaction.aggregate({
          where: { status: 'PAID', createdAt: { gte: monthStart }, order: { tenantId } },
          _sum: { amount: true },
        }),
        (this.prisma as any).transaction.count({
          where: { status: 'PENDING', order: { tenantId } },
        }),
        (this.prisma as any).expense.aggregate({
          where: { tenantId, date: dateRange },
          _sum: { amount: true },
        }),
        (this.prisma as any).order.groupBy({
          where: { tenantId },
          by: ['status'],
          _count: { _all: true },
        }),
        (this.prisma as any).product.aggregate({
          where: { tenantId },
          _sum: { unitPrice: true },
        }),
        (this.prisma as any).$queryRaw`SELECT COUNT(*)::int AS cnt FROM "Product" WHERE "tenantId" = ${tenantId} AND stock <= "minStock"`,
        (this.prisma as any).invoice.aggregate({
          where: { tenantId, status: 'PENDING' },
          _sum: { amount: true }, _count: true,
        }),
        (this.prisma as any).bill.aggregate({
          where: { tenantId, status: 'PENDING' },
          _sum: { amount: true }, _count: true,
        }),
      ]);

      const totalRevenue = Number(revenueAgg._sum.amount ?? 0);
      const totalExpenses = Number(expensesAgg._sum.amount ?? 0);
      const netProfit = totalRevenue - totalExpenses;

      const statusMap: Record<string, number> = {};
      for (const g of orderStatusGroups) statusMap[g.status] = g._count._all;
      const pendingOrders = (statusMap['PENDING'] ?? 0) + (statusMap['PRODUCTION'] ?? 0);
      const completedOrdersCount = (statusMap['COMPLETED'] ?? 0) + (statusMap['DELIVERED'] ?? 0);

      return {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        pendingOrders,
        completedOrders: completedOrdersCount,
        inventoryValue: Number(inventoryAgg._sum.unitPrice ?? 0),
        lowStockCount: Number((lowStockRaw as any[])[0]?.cnt ?? 0),
        paidTransactionsCount: revenueAgg._count,
        pendingTransactionsCount: txCount,
        revenueToday: Number(revenueTodayAgg._sum.amount ?? 0),
        revenueMonth: Number(revenueMonthAgg._sum.amount ?? 0),
        totalReceivablesPending: invoiceAgg._sum.amount ?? 0,
        totalReceivablesPendingCount: invoiceAgg._count ?? 0,
        totalPayablesPending: billAgg._sum.amount ?? 0,
        totalPayablesPendingCount: billAgg._count ?? 0,
      };
    } catch (error) {
      console.error('Error in getSummary:', error);
      throw error;
    }
  }

  private getDateFilter(period: string): Date {
    const now = new Date();
    const date = new Date();
    switch (period) {
      case '7d': date.setDate(now.getDate() - 7); break;
      case '30d': date.setDate(now.getDate() - 30); break;
      case '90d': date.setDate(now.getDate() - 90); break;
      case '12m': date.setFullYear(now.getFullYear() - 1); break;
      default: date.setDate(now.getDate() - 30);
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }

  async getStats(period = '30d', tenantId = 1) {
    await this.checkFeature.execute(tenantId, FeatureKey.FINANCIAL_REPORTS);
    const dateFilter = this.getDateFilter(period);

    const daysCount = period === '7d' ? 7 : 30;
    const trendDays = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      trendDays.push(d);
    }

    const [dailyTransactions, dailyExpenses, ordersWithProducts, expensesByCategory] = await Promise.all([
      (this.prisma as any).transaction.findMany({
        where: { status: 'PAID', createdAt: { gte: dateFilter }, order: { tenantId } },
        select: { amount: true, createdAt: true },
        take: 5000,
      }),
      (this.prisma as any).expense.findMany({
        where: { tenantId, date: { gte: dateFilter } },
        select: { amount: true, date: true, category: true },
        take: 5000,
      }),
      (this.prisma as any).order.findMany({
        where: { tenantId, createdAt: { gte: dateFilter } },
        select: { amount: true, customer: { select: { name: true } } },
        take: 5000,
      }),
      (this.prisma as any).expense.groupBy({
        where: { tenantId, date: { gte: dateFilter } },
        by: ['category'],
        _sum: { amount: true }
      })
    ]);

    // Simplified and robust grouping
    const txGroupByDay: Record<string, number> = {};
    dailyTransactions.forEach((t: any) => {
      const d = new Date(t.createdAt);
      // Use YYYY-MM-DD for stable internal key
      const key = d.toISOString().split('T')[0];
      txGroupByDay[key] = (txGroupByDay[key] || 0) + Number(t.amount || 0);
    });

    const expGroupByDay: Record<string, number> = {};
    dailyExpenses.forEach((e: any) => {
      const d = new Date(e.date);
      const key = d.toISOString().split('T')[0];
      expGroupByDay[key] = (expGroupByDay[key] || 0) + Number(e.amount || 0);
    });

    const salesTrend = trendDays.map(day => {
      const key = day.toISOString().split('T')[0];
      return {
        date: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        weekday: day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        fullDate: day.toISOString(),
        revenue: Number(txGroupByDay[key] || 0),
        expense: Number(expGroupByDay[key] || 0),
      };
    });

    const productionStatsRaw = await (this.prisma as any).order.groupBy({
      where: { tenantId },
      by: ['status'],
      _count: { _all: true },
    });

    const productionStats = productionStatsRaw.map((o: any) => ({
      name: o.status === 'WAITING' ? 'Aguardando' :
            o.status === 'PRODUCTION' ? 'Produção' :
            o.status === 'COMPLETED' ? 'Concluído' :
            o.status === 'DELIVERED' ? 'Entregue' : 'Cancelado',
      count: o._count._all,
    }));

    const customerMap = new Map();
    ordersWithProducts.forEach((o: any) => {
      const name = o.customer?.name || 'Venda Avulsa';
      const current = customerMap.get(name) || 0;
      customerMap.set(name, current + Number(o.amount));
    });

    const topCustomers = Array.from(customerMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      salesTrend,
      productionStats,
      topCustomers,
      expenseBreakdown: expensesByCategory.map((e: any) => ({
        category: e.category,
        total: e._sum.amount
      }))
    };
  }

  async exportDetailedReportPdf(period = '30d', res: any, tenantId = 1) {
    const data = await this.getSummary(period, tenantId);
    const stats = await this.getStats(period, tenantId);
    const dateFilter = this.getDateFilter(period);

    const [expenses, settings] = await Promise.all([
      (this.prisma as any).expense.findMany({
        where: { tenantId, date: { gte: dateFilter } },
        orderBy: { date: 'desc' }
      }),
      (this.prisma as any).settings.findUnique({ where: { tenantId } })
    ]);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const path = require('path');
    const fs = require('fs');

    doc.pipe(res);

    // Header
    let y = 40;
    if (settings?.logoUrl) {
      try {
        const filename = settings.logoUrl.split('/').pop();
        const logoPath = path.join(process.cwd(), 'uploads', filename);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, y, { width: 60 });
        }
      } catch (e) {}
    }

    doc.fillColor('#1e293b').fontSize(20).font('Helvetica-Bold').text('Relatório Financeiro & BI', 110, y + 10);
    doc.fontSize(10).font('Helvetica').text(`Período: ${period.toUpperCase()} (Desde ${dateFilter.toLocaleDateString('pt-BR')})`, 110, y + 35);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 110, y + 48);

    y += 100;
    doc.moveTo(40, y).lineTo(550, y).strokeColor('#e2e8f0').stroke();
    y += 20;

    // KPI Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Resumo Executivo', 40, y);
    y += 30;

    const drawKpi = (label: string, value: string, x: number, color: string) => {
      doc.rect(x, y, 160, 60).fill('#f8fafc');
      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), x + 15, y + 15);
      doc.fillColor(color).fontSize(14).text(value, x + 15, y + 30);
    };

    drawKpi('Faturamento', `R$ ${data.revenue.toFixed(2)}`, 40, '#4f46e5');
    drawKpi('Despesas', `R$ ${data.expenses.toFixed(2)}`, 215, '#ef4444');
    drawKpi('Lucro Líquido', `R$ ${data.netProfit.toFixed(2)}`, 390, data.netProfit >= 0 ? '#10b981' : '#f43f5e');

    y += 100;

    // Expenses Table
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('Detalhamento de Despesas', 40, y);
    y += 25;

    doc.rect(40, y, 510, 20).fill('#f1f5f9');
    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
      .text('DATA', 50, y + 6)
      .text('CATEGORIA', 120, y + 6)
      .text('DESCRIÇÃO', 250, y + 6)
      .text('VALOR', 480, y + 6, { align: 'right', width: 60 });

    y += 25;
    doc.fillColor('#334155').font('Helvetica').fontSize(8);

    expenses.slice(0, 20).forEach((exp: any) => {
      if (y > 750) { doc.addPage(); y = 40; }
      doc.text(new Date(exp.date).toLocaleDateString('pt-BR'), 50, y)
        .text(exp.category, 120, y)
        .text(exp.description.substring(0, 45), 250, y)
        .text(`R$ ${exp.amount.toFixed(2)}`, 480, y, { align: 'right', width: 60 });
      y += 18;
    });

    if (expenses.length > 20) {
      doc.fillColor('#94a3b8').text(`... e mais ${expenses.length - 20} lançamentos`, 40, y + 5);
      y += 30;
    } else {
      y += 20;
    }

    // Top Customers
    if (y > 600) { doc.addPage(); y = 40; }
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('Maiores Clientes no Período', 40, y);
    y += 25;

    stats.topCustomers.forEach((c: any, i: number) => {
      doc.fillColor('#334155').fontSize(9).font('Helvetica')
        .text(`${i + 1}. ${c.name}`, 50, y)
        .text(`R$ ${c.total.toFixed(2)}`, 500, y, { align: 'right' });
      y += 20;
    });

    doc.end();
  }

  async exportTransactionsCsv(tenantId = 1) {
    const transactions = await (this.prisma as any).transaction.findMany({
      where: { order: { tenantId } },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { id: true } } },
      take: 10000,
    });

    const header = 'ID,Data,Pedido,Metodo,Status,Valor\n';
    const rows = transactions.map((t: any) => {
      const date = new Date(t.createdAt).toLocaleDateString('pt-BR');
      const order = t.order?.id || '-';
      return `${t.id},${date},${order},${t.paymentType},${t.status},${t.amount.toFixed(2)}`;
    }).join('\n');

    return header + rows;
  }

  async exportTransactionsXlsx(period: string, res: any, tenantId = 1) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const dateFilter = this.getDateFilter(period || '30d');

    const [settings, summary, transactions, expenses] = await Promise.all([
      (this.prisma as any).settings.findUnique({ where: { tenantId } }),
      this.getSummary(period || '30d', tenantId),
      (this.prisma as any).transaction.findMany({
        where: { order: { tenantId }, createdAt: { gte: dateFilter } },
        orderBy: { createdAt: 'desc' },
        include: { order: { include: { customer: { select: { name: true } } } } },
        take: 10000,
      }),
      (this.prisma as any).expense.findMany({
        where: { tenantId, date: { gte: dateFilter } },
        orderBy: { date: 'desc' },
        take: 10000,
      }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = settings?.companyName || 'GestorPrint';
    wb.created = new Date();

    const BRAND = 'FF1D9E75';
    const BRAND_SOFT = 'FFE1F5EE';
    const SLATE_900 = 'FF0F172A';
    const SLATE_700 = 'FF334155';
    const SLATE_500 = 'FF64748B';
    const SLATE_200 = 'FFE2E8F0';
    const SLATE_50 = 'FFF8FAFC';
    const DANGER = 'FFA32D2D';
    const DANGER_SOFT = 'FFFCEBEB';
    const WARNING = 'FFBA7517';
    const WARNING_SOFT = 'FFFAEEDA';

    const thinBorder: any = {
      top: { style: 'thin', color: { argb: SLATE_200 } },
      bottom: { style: 'thin', color: { argb: SLATE_200 } },
      left: { style: 'thin', color: { argb: SLATE_200 } },
      right: { style: 'thin', color: { argb: SLATE_200 } },
    };

    const resumo = wb.addWorksheet('Resumo', {
      views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    });
    resumo.properties.defaultRowHeight = 20;
    resumo.columns = [
      { width: 28 }, { width: 22 }, { width: 22 }, { width: 22 },
    ];

    resumo.mergeCells('A1:D1');
    const titleCell = resumo.getCell('A1');
    titleCell.value = settings?.companyName || 'GestorPrint';
    titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: SLATE_900 } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    resumo.getRow(1).height = 34;

    resumo.mergeCells('A2:D2');
    const subCell = resumo.getCell('A2');
    subCell.value = 'Relatório financeiro';
    subCell.font = { name: 'Calibri', size: 11, color: { argb: SLATE_500 } };

    resumo.mergeCells('A3:D3');
    const periodCell = resumo.getCell('A3');
    const periodLabel = (period || '30d').toUpperCase();
    periodCell.value = `Período: ${periodLabel}  ·  Desde ${dateFilter.toLocaleDateString('pt-BR')}  ·  Gerado em ${new Date().toLocaleString('pt-BR')}`;
    periodCell.font = { name: 'Calibri', size: 10, color: { argb: SLATE_500 } };

    resumo.mergeCells('A5:D5');
    resumo.getRow(5).height = 4;
    resumo.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

    const kpis = [
      { label: 'Receita', value: summary.revenue, color: BRAND, soft: BRAND_SOFT, raw: false },
      { label: 'Despesas', value: summary.expenses, color: DANGER, soft: DANGER_SOFT, raw: false },
      { label: 'Lucro líquido', value: summary.netProfit,
        color: summary.netProfit >= 0 ? BRAND : DANGER,
        soft: summary.netProfit >= 0 ? BRAND_SOFT : DANGER_SOFT, raw: false },
      { label: 'Pendentes (transações)', value: summary.pendingTransactionsCount || 0, color: WARNING, soft: WARNING_SOFT, raw: true },
    ];

    const kpiRow = 7;
    for (let i = 0; i < kpis.length; i++) {
      const k = kpis[i]!;
      const col = (i % 2) * 2;
      const r = kpiRow + Math.floor(i / 2) * 3;

      resumo.mergeCells(r, col + 1, r, col + 2);
      const lbl = resumo.getCell(r, col + 1);
      lbl.value = k.label;
      lbl.font = { name: 'Calibri', size: 10, color: { argb: SLATE_500 } };
      lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.soft } };
      lbl.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      lbl.border = { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right };
      resumo.getRow(r).height = 22;

      resumo.mergeCells(r + 1, col + 1, r + 1, col + 2);
      const val = resumo.getCell(r + 1, col + 1);
      val.value = k.value || 0;
      val.numFmt = k.raw ? '0' : '"R$"#,##0.00';
      val.font = { name: 'Calibri', size: 18, bold: true, color: { argb: k.color } };
      val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.soft } };
      val.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      val.border = { bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right };
      resumo.getRow(r + 1).height = 32;
    }

    let secRow = kpiRow + 6 + 1;
    resumo.mergeCells(`A${secRow}:D${secRow}`);
    const secTitle = resumo.getCell(`A${secRow}`);
    secTitle.value = 'Detalhamento';
    secTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: SLATE_900 } };
    resumo.getRow(secRow).height = 26;
    secRow += 1;

    const details: [string, any, string?][] = [
      ['Receita hoje', summary.revenueToday, '"R$"#,##0.00'],
      ['Receita no mês', summary.revenueMonth, '"R$"#,##0.00'],
      ['Transações pagas', summary.paidTransactionsCount || 0, '0'],
      ['Transações pendentes', summary.pendingTransactionsCount || 0, '0'],
      ['A receber (faturas)', summary.totalReceivablesPending || 0, '"R$"#,##0.00'],
      ['A pagar (contas)', summary.totalPayablesPending || 0, '"R$"#,##0.00'],
      ['Pedidos pendentes', summary.pendingOrders || 0, '0'],
      ['Pedidos concluídos', summary.completedOrders || 0, '0'],
    ];

    for (const [label, value, fmt] of details) {
      resumo.mergeCells(secRow, 1, secRow, 3);
      const lbl = resumo.getCell(secRow, 1);
      lbl.value = label;
      lbl.font = { name: 'Calibri', size: 11, color: { argb: SLATE_700 } };
      lbl.alignment = { vertical: 'middle', indent: 1 };
      lbl.border = { bottom: { style: 'thin', color: { argb: SLATE_200 } } };

      const val = resumo.getCell(secRow, 4);
      val.value = value;
      val.numFmt = fmt || '0';
      val.font = { name: 'Calibri', size: 11, bold: true, color: { argb: SLATE_900 } };
      val.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      val.border = { bottom: { style: 'thin', color: { argb: SLATE_200 } } };

      resumo.getRow(secRow).height = 22;
      secRow += 1;
    }

    const tx = wb.addWorksheet('Transações', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    });

    tx.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Data', key: 'date', width: 12 },
      { header: 'Cliente', key: 'customer', width: 32 },
      { header: 'Pedido #', key: 'orderId', width: 12 },
      { header: 'Método', key: 'method', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Valor', key: 'amount', width: 16 },
    ];

    const txHeader = tx.getRow(1);
    txHeader.height = 30;
    txHeader.eachCell((cell: any) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_900 } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = thinBorder;
    });

    for (const t of transactions) {
      const row = tx.addRow({
        id: `#TRX-${t.id}`,
        date: new Date(t.createdAt),
        customer: t.order?.customer?.name || 'Venda avulsa',
        orderId: t.order?.id ? `#${t.order.id}` : '—',
        method: t.paymentType,
        status: t.status === 'PAID' ? 'Pago' : t.status === 'PENDING' ? 'Pendente' : t.status,
        amount: Number(t.amount || 0),
      });

      row.height = 22;
      row.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: SLATE_700 } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: SLATE_200 } } };
      });

      row.getCell('date').numFmt = 'dd/mm/yyyy';
      row.getCell('amount').numFmt = '"R$"#,##0.00';
      row.getCell('amount').font = { name: 'Calibri', size: 10, bold: true, color: { argb: SLATE_900 } };
      row.getCell('amount').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

      const statusCell = row.getCell('status');
      if (t.status === 'PAID') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } };
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND } };
      } else if (t.status === 'PENDING') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNING_SOFT } };
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WARNING } };
      }
    }

    if (transactions.length > 0) {
      const totalRowIdx = tx.rowCount + 2;
      tx.mergeCells(totalRowIdx, 1, totalRowIdx, 6);
      const lbl = tx.getCell(totalRowIdx, 1);
      lbl.value = 'Total';
      lbl.font = { name: 'Calibri', size: 11, bold: true, color: { argb: SLATE_900 } };
      lbl.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };

      const sumCell = tx.getCell(totalRowIdx, 7);
      sumCell.value = { formula: `SUM(G2:G${tx.rowCount - 1})`, result: transactions.reduce((s: number, t: any) => s + Number(t.amount || 0), 0) };
      sumCell.numFmt = '"R$"#,##0.00';
      sumCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: BRAND } };
      sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
      sumCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      sumCell.border = { top: { style: 'medium', color: { argb: BRAND } } };
      tx.getRow(totalRowIdx).height = 30;
    } else {
      tx.addRow([]);
      const r = tx.addRow(['Nenhuma transação no período selecionado.']);
      r.getCell(1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: SLATE_500 } };
    }

    const exp = wb.addWorksheet('Despesas', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    });

    exp.columns = [
      { header: 'Data', key: 'date', width: 12 },
      { header: 'Categoria', key: 'category', width: 22 },
      { header: 'Descrição', key: 'description', width: 48 },
      { header: 'Valor', key: 'amount', width: 16 },
    ];

    const expHeader = exp.getRow(1);
    expHeader.height = 30;
    expHeader.eachCell((cell: any) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_900 } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = thinBorder;
    });

    for (const e of expenses) {
      const row = exp.addRow({
        date: new Date(e.date),
        category: e.category || '—',
        description: e.description || '',
        amount: Number(e.amount || 0),
      });

      row.height = 22;
      row.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: SLATE_700 } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: SLATE_200 } } };
      });

      row.getCell('date').numFmt = 'dd/mm/yyyy';
      row.getCell('amount').numFmt = '"R$"#,##0.00';
      row.getCell('amount').font = { name: 'Calibri', size: 10, bold: true, color: { argb: DANGER } };
      row.getCell('amount').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    }

    if (expenses.length > 0) {
      const totalRowIdx = exp.rowCount + 2;
      exp.mergeCells(totalRowIdx, 1, totalRowIdx, 3);
      const lbl = exp.getCell(totalRowIdx, 1);
      lbl.value = 'Total de despesas';
      lbl.font = { name: 'Calibri', size: 11, bold: true, color: { argb: SLATE_900 } };
      lbl.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };

      const sumCell = exp.getCell(totalRowIdx, 4);
      sumCell.value = { formula: `SUM(D2:D${exp.rowCount - 1})`, result: expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) };
      sumCell.numFmt = '"R$"#,##0.00';
      sumCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: DANGER } };
      sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
      sumCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      sumCell.border = { top: { style: 'medium', color: { argb: DANGER } } };
      exp.getRow(totalRowIdx).height = 30;
    } else {
      exp.addRow([]);
      const r = exp.addRow(['Nenhuma despesa no período selecionado.']);
      r.getCell(1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: SLATE_500 } };
    }

    await wb.xlsx.write(res);
    res.end();
  }

  /**
   * Relatórios avançados: pipeline orçamentos, vendas por pessoa,
   * aging contas a receber, vendas por tipo de serviço.
   * Aceita startDate/endDate custom ou fallback pro period.
   */
  async getAdvanced(
    tenantId: number,
    opts: { startDate?: string; endDate?: string; period?: string } = {},
  ) {
    await this.checkFeature.execute(tenantId, FeatureKey.FINANCIAL_REPORTS);

    const startFilter = opts.startDate
      ? new Date(`${opts.startDate}T00:00:00.000Z`)
      : this.getDateFilter(opts.period || '30d');
    const endFilter = opts.endDate
      ? new Date(`${opts.endDate}T23:59:59.999Z`)
      : new Date();

    const [
      estimates,
      salesByPersonRaw,
      productionByPersonRaw,
      pendingInvoices,
      estimatesByType,
      pdvOrders,
      estimateOrders,
    ] = await Promise.all([
      // Pipeline de orçamentos (agrupado por status)
      (this.prisma as any).estimate.groupBy({
        where: { tenantId, createdAt: { gte: startFilter, lte: endFilter } },
        by: ['status'],
        _count: { _all: true },
        _sum: { totalPrice: true },
      }),

      // Vendas por vendedor (Orders com salespersonId não nulo)
      (this.prisma as any).order.groupBy({
        where: {
          tenantId,
          createdAt: { gte: startFilter, lte: endFilter },
          salespersonId: { not: null },
        },
        by: ['salespersonId'],
        _count: { _all: true },
        _sum: { amount: true },
      }),

      // Produção por produtor
      (this.prisma as any).order.groupBy({
        where: {
          tenantId,
          createdAt: { gte: startFilter, lte: endFilter },
          producerId: { not: null },
        },
        by: ['producerId'],
        _count: { _all: true },
        _sum: { amount: true },
      }),

      // Faturas pendentes (pra aging)
      (this.prisma as any).invoice.findMany({
        where: { tenantId, status: { in: ['PENDING', 'OVERDUE'] } },
        select: { id: true, amount: true, dueDate: true },
      }),

      // Orçamentos por tipo (service/plotter/cutting/embroidery)
      (this.prisma as any).estimate.groupBy({
        where: { tenantId, createdAt: { gte: startFilter, lte: endFilter } },
        by: ['estimateType'],
        _count: { _all: true },
        _sum: { totalPrice: true },
      }),

      // Pedidos PDV (sem estimateId)
      (this.prisma as any).order.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startFilter, lte: endFilter },
          estimateId: null,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),

      // Pedidos convertidos de orçamento (com estimateId)
      (this.prisma as any).order.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startFilter, lte: endFilter },
          estimateId: { not: null },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    // Buscar nomes dos usuários envolvidos
    const userIds = new Set<number>();
    for (const s of salesByPersonRaw) if (s.salespersonId) userIds.add(s.salespersonId);
    for (const p of productionByPersonRaw) if (p.producerId) userIds.add(p.producerId);

    const users = userIds.size
      ? await (this.prisma as any).user.findMany({
          where: { id: { in: Array.from(userIds) }, tenantId },
          select: { id: true, name: true, role: true, commissionRate: true },
        })
      : [];
    const userMap = new Map<number, any>(users.map((u: any) => [u.id, u]));

    // Mapear grupos pra objetos amigáveis
    const estimatePipeline = estimates.map((e: any) => ({
      status: e.status,
      count: e._count._all,
      total: Number(e._sum.totalPrice ?? 0),
    }));

    const salesByPerson = salesByPersonRaw
      .map((s: any) => {
        const u = userMap.get(s.salespersonId);
        const revenue = Number(s._sum.amount ?? 0);
        const commissionRate = Number(u?.commissionRate ?? 0);
        return {
          userId: s.salespersonId,
          name: u?.name ?? 'Desconhecido',
          orderCount: s._count._all,
          revenue,
          commission: revenue * (commissionRate / 100),
        };
      })
      .sort((a: any, b: any) => b.revenue - a.revenue);

    const productionByPerson = productionByPersonRaw
      .map((p: any) => ({
        userId: p.producerId,
        name: userMap.get(p.producerId)?.name ?? 'Desconhecido',
        orderCount: p._count._all,
        revenue: Number(p._sum.amount ?? 0),
      }))
      .sort((a: any, b: any) => b.orderCount - a.orderCount);

    // Aging buckets (apenas faturas com dueDate no passado)
    const now = new Date();
    const buckets = {
      '0-30':  { count: 0, total: 0 },
      '31-60': { count: 0, total: 0 },
      '61-90': { count: 0, total: 0 },
      '90+':   { count: 0, total: 0 },
    } as Record<string, { count: number; total: number }>;

    for (const inv of pendingInvoices) {
      const due = new Date(inv.dueDate);
      const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (days < 0) continue; // ainda não venceu
      const bucket =
        days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      buckets[bucket]!.count += 1;
      buckets[bucket]!.total += Number(inv.amount);
    }

    const invoiceAging = Object.entries(buckets).map(([bucket, v]) => ({
      bucket,
      count: v.count,
      total: v.total,
    }));

    // Vendas por tipo: orçamentos agrupados + PDV + estimativas convertidas
    const typeLabels: Record<string, string> = {
      service: 'Serviço',
      plotter: 'Plotter',
      cutting: 'Corte',
      embroidery: 'Bordado',
    };

    const salesByType = [
      ...estimatesByType.map((e: any) => ({
        type: typeLabels[e.estimateType] || e.estimateType,
        key: e.estimateType,
        count: e._count._all,
        total: Number(e._sum.totalPrice ?? 0),
      })),
      {
        type: 'PDV Balcão',
        key: 'pdv',
        count: pdvOrders._count?._all ?? 0,
        total: Number(pdvOrders._sum?.amount ?? 0),
      },
    ]
      .filter((x) => x.count > 0 || x.total > 0)
      .sort((a, b) => b.total - a.total);

    // Taxa de conversão orçamentos → pedidos
    const totalEstimates = estimatePipeline.reduce((s: number, e: any) => s + e.count, 0);
    const approvedEstimates = estimatePipeline
      .filter((e: any) => e.status === 'APPROVED')
      .reduce((s: number, e: any) => s + e.count, 0);
    const conversionRate = totalEstimates > 0 ? (approvedEstimates / totalEstimates) * 100 : 0;

    return {
      period: {
        startDate: startFilter.toISOString(),
        endDate: endFilter.toISOString(),
      },
      estimatePipeline,
      conversionRate,
      salesByPerson,
      productionByPerson,
      invoiceAging,
      salesByType,
      pdvVsEstimate: {
        pdv: {
          count: pdvOrders._count?._all ?? 0,
          total: Number(pdvOrders._sum?.amount ?? 0),
        },
        fromEstimate: {
          count: estimateOrders._count?._all ?? 0,
          total: Number(estimateOrders._sum?.amount ?? 0),
        },
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // XLSX Exports — helpers compartilhados
  // ════════════════════════════════════════════════════════════════════════

  private xlsxTheme() {
    return {
      BRAND: 'FF1D9E75',
      BRAND_SOFT: 'FFE1F5EE',
      SLATE_900: 'FF0F172A',
      SLATE_700: 'FF334155',
      SLATE_500: 'FF64748B',
      SLATE_200: 'FFE2E8F0',
      SLATE_50: 'FFF8FAFC',
      DANGER: 'FFA32D2D',
      DANGER_SOFT: 'FFFCEBEB',
      WARNING: 'FFBA7517',
      WARNING_SOFT: 'FFFAEEDA',
      INFO: 'FF185FA5',
      INFO_SOFT: 'FFE6F1FB',
    };
  }

  private xlsxHeaderRow(ws: any, T: any) {
    const header = ws.getRow(1);
    header.height = 30;
    header.eachCell((cell: any) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: T.SLATE_900 } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = {
        top: { style: 'thin', color: { argb: T.SLATE_200 } },
        bottom: { style: 'thin', color: { argb: T.SLATE_200 } },
      };
    });
  }

  private xlsxTitle(ws: any, company: string, subtitle: string, context: string, T: any) {
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = company;
    titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: T.SLATE_900 } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 34;

    ws.mergeCells('A2:F2');
    const sub = ws.getCell('A2');
    sub.value = subtitle;
    sub.font = { name: 'Calibri', size: 11, color: { argb: T.SLATE_500 } };

    ws.mergeCells('A3:F3');
    const ctx = ws.getCell('A3');
    ctx.value = context;
    ctx.font = { name: 'Calibri', size: 10, color: { argb: T.SLATE_500 } };

    ws.mergeCells('A5:F5');
    ws.getRow(5).height = 4;
    ws.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: T.BRAND } };
  }

  // ════════════════════════════════════════════════════════════════════════
  // XLSX — Vendas
  // ════════════════════════════════════════════════════════════════════════
  async exportSalesXlsx(
    res: any,
    tenantId: number,
    opts: { period?: string; startDate?: string; endDate?: string } = {},
  ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');

    const startFilter = opts.startDate
      ? new Date(`${opts.startDate}T00:00:00.000Z`)
      : this.getDateFilter(opts.period || '30d');
    const endFilter = opts.endDate
      ? new Date(`${opts.endDate}T23:59:59.999Z`)
      : new Date();

    const [settings, advanced] = await Promise.all([
      (this.prisma as any).settings.findUnique({ where: { tenantId } }),
      this.getAdvanced(tenantId, opts),
    ]);

    const T = this.xlsxTheme();
    const wb = new ExcelJS.Workbook();
    wb.creator = settings?.companyName || 'GestorPrint';
    wb.created = new Date();

    const ctxStr = `Período: ${startFilter.toLocaleDateString('pt-BR')} a ${endFilter.toLocaleDateString('pt-BR')}  ·  Gerado em ${new Date().toLocaleString('pt-BR')}`;

    // ── Aba 1: Resumo ───────────────────────────────────────────────
    const resumo = wb.addWorksheet('Resumo', { views: [{ state: 'frozen', ySplit: 6, showGridLines: false }] });
    resumo.columns = [{ width: 32 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 18 }, { width: 18 }];
    this.xlsxTitle(resumo, settings?.companyName || 'GestorPrint', 'Relatório de Vendas', ctxStr, T);

    let row = 7;
    const kpis: [string, any, string?][] = [
      ['Taxa de conversão', advanced.conversionRate / 100, '0.0%'],
      ['Total de orçamentos', advanced.estimatePipeline.reduce((s: number, e: any) => s + e.count, 0), '0'],
      ['Valor total em pipeline', advanced.estimatePipeline.reduce((s: number, e: any) => s + e.total, 0), '"R$"#,##0.00'],
      ['Vendedores ativos', advanced.salesByPerson.length, '0'],
    ];
    for (const [label, value, fmt] of kpis) {
      resumo.mergeCells(row, 1, row, 4);
      const l = resumo.getCell(row, 1);
      l.value = label;
      l.font = { name: 'Calibri', size: 11, color: { argb: T.SLATE_700 } };
      l.alignment = { vertical: 'middle', indent: 1 };
      l.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      const v = resumo.getCell(row, 5);
      v.value = value;
      v.numFmt = fmt || '0';
      v.font = { name: 'Calibri', size: 11, bold: true, color: { argb: T.SLATE_900 } };
      v.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      v.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      resumo.getRow(row).height = 22;
      row += 1;
    }

    // ── Aba 2: Pipeline ───────────────────────────────────────────────
    const pipeline = wb.addWorksheet('Pipeline', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    pipeline.columns = [
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Quantidade', key: 'count', width: 15 },
      { header: 'Valor total', key: 'total', width: 20 },
    ];
    this.xlsxHeaderRow(pipeline, T);

    const statusLabels: Record<string, string> = {
      DRAFT: 'Rascunho', SENT: 'Enviado', APPROVED: 'Aprovado', REJECTED: 'Rejeitado', CONVERTED: 'Convertido',
    };
    for (const p of advanced.estimatePipeline) {
      const r = pipeline.addRow({ status: statusLabels[p.status] || p.status, count: p.count, total: p.total });
      r.height = 22;
      r.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: T.SLATE_700 } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      });
      r.getCell('total').numFmt = '"R$"#,##0.00';
      r.getCell('total').font = { name: 'Calibri', size: 10, bold: true, color: { argb: T.SLATE_900 } };
      r.getCell('total').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    }

    // ── Aba 3: Vendas por tipo ──────────────────────────────────────
    const tipos = wb.addWorksheet('Vendas por tipo', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    tipos.columns = [
      { header: 'Tipo', key: 'type', width: 22 },
      { header: 'Pedidos', key: 'count', width: 12 },
      { header: 'Receita', key: 'total', width: 20 },
    ];
    this.xlsxHeaderRow(tipos, T);

    for (const t of advanced.salesByType) {
      const r = tipos.addRow({ type: t.type, count: t.count, total: t.total });
      r.height = 22;
      r.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: T.SLATE_700 } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      });
      r.getCell('total').numFmt = '"R$"#,##0.00';
      r.getCell('total').font = { name: 'Calibri', size: 10, bold: true, color: { argb: T.BRAND } };
      r.getCell('total').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    }

    // ── Aba 4: Vendedores ────────────────────────────────────────────
    const vendedores = wb.addWorksheet('Vendedores', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    vendedores.columns = [
      { header: 'Posição', key: 'rank', width: 10 },
      { header: 'Vendedor', key: 'name', width: 30 },
      { header: 'Pedidos', key: 'count', width: 12 },
      { header: 'Receita', key: 'revenue', width: 18 },
      { header: 'Comissão', key: 'commission', width: 18 },
    ];
    this.xlsxHeaderRow(vendedores, T);

    advanced.salesByPerson.forEach((s: any, i: number) => {
      const r = vendedores.addRow({
        rank: `#${i + 1}`,
        name: s.name,
        count: s.orderCount,
        revenue: s.revenue,
        commission: s.commission,
      });
      r.height = 22;
      r.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: T.SLATE_700 } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      });
      r.getCell('revenue').numFmt = '"R$"#,##0.00';
      r.getCell('revenue').font = { name: 'Calibri', size: 10, bold: true, color: { argb: T.BRAND } };
      r.getCell('revenue').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      r.getCell('commission').numFmt = '"R$"#,##0.00';
      r.getCell('commission').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio-vendas.xlsx');
    await wb.xlsx.write(res);
    res.end();
  }

  // ════════════════════════════════════════════════════════════════════════
  // XLSX — Produção
  // ════════════════════════════════════════════════════════════════════════
  async exportProductionXlsx(
    res: any,
    tenantId: number,
    opts: { period?: string; startDate?: string; endDate?: string } = {},
  ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');

    const startFilter = opts.startDate
      ? new Date(`${opts.startDate}T00:00:00.000Z`)
      : this.getDateFilter(opts.period || '30d');
    const endFilter = opts.endDate
      ? new Date(`${opts.endDate}T23:59:59.999Z`)
      : new Date();

    const [settings, summary, advanced, lowStockProducts] = await Promise.all([
      (this.prisma as any).settings.findUnique({ where: { tenantId } }),
      this.getSummary(opts.period || '30d', tenantId, opts),
      this.getAdvanced(tenantId, opts),
      (this.prisma as any).$queryRaw`SELECT name, stock, "minStock", unit FROM "Product" WHERE "tenantId" = ${tenantId} AND stock <= "minStock" ORDER BY stock ASC LIMIT 200`,
    ]);

    const T = this.xlsxTheme();
    const wb = new ExcelJS.Workbook();
    wb.creator = settings?.companyName || 'GestorPrint';
    wb.created = new Date();

    const ctxStr = `Período: ${startFilter.toLocaleDateString('pt-BR')} a ${endFilter.toLocaleDateString('pt-BR')}  ·  Gerado em ${new Date().toLocaleString('pt-BR')}`;

    // ── Aba 1: Status de produção ────────────────────────────────────
    const statusWs = wb.addWorksheet('Status', { views: [{ state: 'frozen', ySplit: 6, showGridLines: false }] });
    statusWs.columns = [{ width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    this.xlsxTitle(statusWs, settings?.companyName || 'GestorPrint', 'Relatório de Produção', ctxStr, T);

    let row = 7;
    statusWs.mergeCells(row, 1, row, 2);
    const sh = statusWs.getCell(row, 1);
    sh.value = 'Resumo de produção';
    sh.font = { name: 'Calibri', size: 13, bold: true, color: { argb: T.SLATE_900 } };
    statusWs.getRow(row).height = 26;
    row += 1;

    const kpis: [string, any, string?][] = [
      ['Pedidos pendentes', summary.pendingOrders || 0, '0'],
      ['Pedidos concluídos', summary.completedOrders || 0, '0'],
      ['Valor em estoque', summary.inventoryValue || 0, '"R$"#,##0.00'],
      ['Itens com estoque baixo', summary.lowStockCount || 0, '0'],
    ];
    for (const [label, value, fmt] of kpis) {
      statusWs.mergeCells(row, 1, row, 4);
      const l = statusWs.getCell(row, 1);
      l.value = label;
      l.font = { name: 'Calibri', size: 11, color: { argb: T.SLATE_700 } };
      l.alignment = { vertical: 'middle', indent: 1 };
      l.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      const v = statusWs.getCell(row, 5);
      v.value = value;
      v.numFmt = fmt || '0';
      v.font = { name: 'Calibri', size: 11, bold: true, color: { argb: T.SLATE_900 } };
      v.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      v.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      statusWs.getRow(row).height = 22;
      row += 1;
    }

    // ── Aba 2: Produtores ────────────────────────────────────────────
    const produtores = wb.addWorksheet('Produtores', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    produtores.columns = [
      { header: 'Posição', key: 'rank', width: 10 },
      { header: 'Produtor', key: 'name', width: 30 },
      { header: 'Pedidos', key: 'count', width: 12 },
      { header: 'Valor em produção', key: 'revenue', width: 22 },
    ];
    this.xlsxHeaderRow(produtores, T);

    advanced.productionByPerson.forEach((p: any, i: number) => {
      const r = produtores.addRow({ rank: `#${i + 1}`, name: p.name, count: p.orderCount, revenue: p.revenue });
      r.height = 22;
      r.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: T.SLATE_700 } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      });
      r.getCell('revenue').numFmt = '"R$"#,##0.00';
      r.getCell('revenue').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    });

    // ── Aba 3: Estoque baixo ─────────────────────────────────────────
    const estoque = wb.addWorksheet('Estoque baixo', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    estoque.columns = [
      { header: 'Insumo', key: 'name', width: 40 },
      { header: 'Estoque atual', key: 'stock', width: 16 },
      { header: 'Mínimo', key: 'minStock', width: 14 },
      { header: 'Unidade', key: 'unit', width: 12 },
    ];
    this.xlsxHeaderRow(estoque, T);

    for (const p of lowStockProducts) {
      const r = estoque.addRow({ name: p.name, stock: p.stock, minStock: p.minStock, unit: p.unit });
      r.height = 22;
      r.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: T.SLATE_700 } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: T.SLATE_200 } } };
      });
      r.getCell('stock').font = { name: 'Calibri', size: 10, bold: true, color: { argb: T.DANGER } };
      r.getCell('stock').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      r.getCell('minStock').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    }

    if (lowStockProducts.length === 0) {
      estoque.addRow([]);
      const r = estoque.addRow(['Nenhum item com estoque baixo.']);
      r.getCell(1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: T.BRAND } };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio-producao.xlsx');
    await wb.xlsx.write(res);
    res.end();
  }
}
