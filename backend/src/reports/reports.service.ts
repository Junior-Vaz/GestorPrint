import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(period = '30d') {
    try {
      const dateFilter = this.getDateFilter(period);
      
      const [orders, transactions, products, expenses] = await Promise.all([
        (this.prisma as any).order.findMany({ where: { createdAt: { gte: dateFilter } } }),
        (this.prisma as any).transaction.findMany({ 
          where: { status: 'PAID', createdAt: { gte: dateFilter } } 
        }),
        (this.prisma as any).product.findMany(),
        (this.prisma as any).expense.findMany({ where: { date: { gte: dateFilter } } }),
      ]);

      const totalRevenue = transactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
      const netProfit = totalRevenue - totalExpenses;

      const pendingOrders = orders.filter((o: any) => o.status === 'PENDING' || o.status === 'PRODUCTION').length;
      const completedOrdersCount = orders.filter((o: any) => o.status === 'COMPLETED' || o.status === 'DELIVERED').length;
      
      const totalInventoryValue = products.reduce((sum: number, p: any) => sum + (Number(p.unitPrice) * Number(p.stock)), 0);
      const lowStockCount = products.filter((p: any) => Number(p.stock) <= Number(p.minStock)).length;

      return {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        pendingOrders,
        completedOrders: completedOrdersCount,
        inventoryValue: totalInventoryValue,
        lowStockCount,
        paidTransactionsCount: transactions.length,
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

  async getStats(period = '30d') {
    const dateFilter = this.getDateFilter(period);
    
    // Trend calculation
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
        where: { status: 'PAID', createdAt: { gte: dateFilter } },
        select: { amount: true, createdAt: true },
      }),
      (this.prisma as any).expense.findMany({
        where: { date: { gte: dateFilter } },
        select: { amount: true, date: true, category: true },
      }),
      (this.prisma as any).order.findMany({
        where: { createdAt: { gte: dateFilter } },
        include: { customer: true }
      }),
      (this.prisma as any).expense.groupBy({
        where: { date: { gte: dateFilter } },
        by: ['category'],
        _sum: { amount: true }
      })
    ]);

    const salesTrend = trendDays.map(day => {
      const dayIso = day.toISOString().split('T')[0];
      
      const matchedTxs = dailyTransactions.filter((t: any) => {
        const txDate = new Date(t.createdAt).toISOString().split('T')[0];
        return txDate === dayIso;
      });
      
      const revenue = matchedTxs.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      
      const expense = dailyExpenses
        .filter((e: any) => new Date(e.date).toISOString().split('T')[0] === dayIso)
        .reduce((sum: number, e: any) => sum + Number(e.amount), 0);
      
      return {
        date: day.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
        revenue,
        expense,
      };
    });

    const productionStatsRaw = await (this.prisma as any).order.groupBy({
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
  async exportDetailedReportPdf(period = '30d', res: any) {
    const data = await this.getSummary(period);
    const stats = await this.getStats(period);
    const dateFilter = this.getDateFilter(period);
    
    // Fetch all relevant detailed data
    const [expenses, settings] = await Promise.all([
      (this.prisma as any).expense.findMany({ 
        where: { date: { gte: dateFilter } }, 
        orderBy: { date: 'desc' } 
      }),
      (this.prisma as any).settings.findUnique({ where: { id: 1 } })
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

  async exportTransactionsCsv() {
    const transactions = await (this.prisma as any).transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { order: true },
    });

    const header = 'ID,Data,Pedido,Metodo,Status,Valor\n';
    const rows = transactions.map((t: any) => {
      const date = new Date(t.createdAt).toLocaleDateString('pt-BR');
      const order = t.order?.id || '-';
      return `${t.id},${date},${order},${t.paymentType},${t.status},${t.amount.toFixed(2)}`;
    }).join('\n');

    return header + rows;
  }
}
