import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationDto, PaginatedResult, paginateResult } from '../../../shared/dto/pagination.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createExpenseDto: CreateExpenseDto, tenantId: number) {
    const expense = await (this.prisma as any).expense.create({
      data: {
        ...createExpenseDto,
        tenantId,
        date: createExpenseDto.date ? new Date(createExpenseDto.date) : new Date(),
      },
    });

    await this.notificationsService.create({
      tenantId,
      title:   'Nova Despesa / Saída',
      message: `Registrada uma saída de R$ ${createExpenseDto.amount.toFixed(2)}: ${createExpenseDto.description}`,
      type:    createExpenseDto.category === 'Sangria' ? 'ALERTA' : 'INFO',
    });

    return expense;
  }

  async findAll(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<any>> {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const { search, status: category, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.date.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const [data, total] = await (this.prisma as any).$transaction([
      (this.prisma as any).expense.findMany({ where, orderBy: { date: 'desc' }, skip, take: limit }),
      (this.prisma as any).expense.count({ where }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async update(id: number, updateExpenseDto: UpdateExpenseDto, tenantId: number) {
    return (this.prisma as any).expense.updateMany({
      where: { id, tenantId },
      data: {
        ...updateExpenseDto,
        date: updateExpenseDto.date ? new Date(updateExpenseDto.date) : undefined,
      },
    });
  }

  async remove(id: number, tenantId: number) {
    return (this.prisma as any).expense.deleteMany({
      where: { id, tenantId },
    });
  }

  // Categories
  async createCategory(name: string, tenantId: number) {
    return (this.prisma as any).expenseCategory.create({
      data: { name, tenantId },
    });
  }

  async findAllCategories(tenantId: number) {
    const categories = await (this.prisma as any).expenseCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      const defaults = ['Sangria', 'Insumos', 'Aluguel', 'Salários', 'Energia', 'Marketing', 'Manutenção', 'Impostos', 'Outros'];
      await (this.prisma as any).expenseCategory.createMany({
        data: defaults.map(name => ({ name, tenantId })),
        skipDuplicates: true,
      });
      return (this.prisma as any).expenseCategory.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    }

    return categories;
  }

  async removeCategory(id: number, tenantId: number) {
    return (this.prisma as any).expenseCategory.deleteMany({
      where: { id, tenantId },
    });
  }

  async exportCsv(tenantId: number) {
    const expenses = await (this.prisma as any).expense.findMany({
      where: { tenantId },
      orderBy: { date: 'desc' },
      include: { supplier: true },
    });

    const header = 'ID,Data,Descricao,Categoria,Fornecedor,Valor\n';
    const rows = expenses.map((e: any) => {
      const date = new Date(e.date).toLocaleDateString('pt-BR');
      const supplier = e.supplier?.name || '-';
      return `${e.id},${date},"${e.description}",${e.category},"${supplier}",${e.amount.toFixed(2)}`;
    }).join('\n');

    return header + rows;
  }

  async exportXlsx(res: any, tenantId: number) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');

    const [settings, expenses, categoryAgg] = await Promise.all([
      (this.prisma as any).settings.findUnique({ where: { tenantId } }),
      (this.prisma as any).expense.findMany({
        where: { tenantId },
        orderBy: { date: 'desc' },
        include: { supplier: true },
      }),
      (this.prisma as any).expense.groupBy({
        where: { tenantId },
        by: ['category'],
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = settings?.companyName || 'GestorPrint';
    wb.created = new Date();

    const BRAND = 'FF1D9E75';
    const SLATE_900 = 'FF0F172A';
    const SLATE_700 = 'FF334155';
    const SLATE_500 = 'FF64748B';
    const SLATE_200 = 'FFE2E8F0';
    const SLATE_50 = 'FFF8FAFC';
    const DANGER = 'FFA32D2D';
    const DANGER_SOFT = 'FFFCEBEB';

    const thinBorder: any = {
      top: { style: 'thin', color: { argb: SLATE_200 } },
      bottom: { style: 'thin', color: { argb: SLATE_200 } },
      left: { style: 'thin', color: { argb: SLATE_200 } },
      right: { style: 'thin', color: { argb: SLATE_200 } },
    };

    const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const now = new Date();
    const month = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // ══════════════════════════════════════════════════════════
    // Aba 1 — Resumo
    // ══════════════════════════════════════════════════════════
    const resumo = wb.addWorksheet('Resumo', {
      views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    });
    resumo.properties.defaultRowHeight = 20;
    resumo.columns = [{ width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }];

    resumo.mergeCells('A1:D1');
    const titleCell = resumo.getCell('A1');
    titleCell.value = settings?.companyName || 'GestorPrint';
    titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: SLATE_900 } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    resumo.getRow(1).height = 34;

    resumo.mergeCells('A2:D2');
    const subCell = resumo.getCell('A2');
    subCell.value = 'Relatório de despesas';
    subCell.font = { name: 'Calibri', size: 11, color: { argb: SLATE_500 } };

    resumo.mergeCells('A3:D3');
    const periodCell = resumo.getCell('A3');
    periodCell.value = `Referência: ${month}  ·  Gerado em ${now.toLocaleString('pt-BR')}  ·  ${expenses.length} lançamento${expenses.length === 1 ? '' : 's'}`;
    periodCell.font = { name: 'Calibri', size: 10, color: { argb: SLATE_500 } };

    resumo.mergeCells('A5:D5');
    resumo.getRow(5).height = 4;
    resumo.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DANGER } };

    // Total em destaque
    resumo.mergeCells('A7:D7');
    const totalLabel = resumo.getCell('A7');
    totalLabel.value = 'Total de despesas';
    totalLabel.font = { name: 'Calibri', size: 10, color: { argb: DANGER } };
    totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DANGER_SOFT } };
    totalLabel.alignment = { vertical: 'middle', indent: 1 };
    totalLabel.border = { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right };
    resumo.getRow(7).height = 22;

    resumo.mergeCells('A8:D8');
    const totalValue = resumo.getCell('A8');
    totalValue.value = totalExpenses;
    totalValue.numFmt = '"R$"#,##0.00';
    totalValue.font = { name: 'Calibri', size: 22, bold: true, color: { argb: DANGER } };
    totalValue.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DANGER_SOFT } };
    totalValue.alignment = { vertical: 'middle', indent: 1 };
    totalValue.border = { bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right };
    resumo.getRow(8).height = 36;

    // Por categoria
    let row = 11;
    resumo.mergeCells(`A${row}:D${row}`);
    const secTitle = resumo.getCell(`A${row}`);
    secTitle.value = 'Por categoria';
    secTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: SLATE_900 } };
    resumo.getRow(row).height = 26;
    row += 1;

    // Header da tabela de categorias
    const catHeaders = ['Categoria', 'Quantidade', '% do total', 'Valor'];
    catHeaders.forEach((h, i) => {
      const cell = resumo.getCell(row, i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: SLATE_500 } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
      cell.alignment = { vertical: 'middle', horizontal: i >= 1 ? 'right' : 'left', indent: 1 };
      cell.border = { bottom: thinBorder.bottom };
    });
    resumo.getRow(row).height = 24;
    row += 1;

    const sortedCats = [...categoryAgg].sort((a: any, b: any) => Number(b._sum.amount || 0) - Number(a._sum.amount || 0));
    for (const c of sortedCats) {
      const amount = Number(c._sum.amount || 0);
      const count = c._count?._all || 0;
      const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

      const c1 = resumo.getCell(row, 1);
      c1.value = c.category || 'Sem categoria';
      c1.font = { name: 'Calibri', size: 11, color: { argb: SLATE_700 } };
      c1.alignment = { vertical: 'middle', indent: 1 };

      const c2 = resumo.getCell(row, 2);
      c2.value = count;
      c2.font = { name: 'Calibri', size: 11, color: { argb: SLATE_700 } };
      c2.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

      const c3 = resumo.getCell(row, 3);
      c3.value = pct / 100;
      c3.numFmt = '0.0%';
      c3.font = { name: 'Calibri', size: 11, color: { argb: SLATE_500 } };
      c3.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

      const c4 = resumo.getCell(row, 4);
      c4.value = amount;
      c4.numFmt = '"R$"#,##0.00';
      c4.font = { name: 'Calibri', size: 11, bold: true, color: { argb: DANGER } };
      c4.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

      [c1, c2, c3, c4].forEach(c => c.border = { bottom: { style: 'thin', color: { argb: SLATE_200 } } });
      resumo.getRow(row).height = 22;
      row += 1;
    }

    // ══════════════════════════════════════════════════════════
    // Aba 2 — Lançamentos
    // ══════════════════════════════════════════════════════════
    const ws = wb.addWorksheet('Lançamentos', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    });

    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Data', key: 'date', width: 12 },
      { header: 'Descrição', key: 'description', width: 44 },
      { header: 'Categoria', key: 'category', width: 20 },
      { header: 'Fornecedor', key: 'supplier', width: 22 },
      { header: 'Valor', key: 'amount', width: 16 },
    ];

    const header = ws.getRow(1);
    header.height = 30;
    header.eachCell((cell: any) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_900 } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = thinBorder;
    });

    for (const e of expenses) {
      const r = ws.addRow({
        id: e.id,
        date: new Date(e.date),
        description: e.description || '',
        category: e.category || '—',
        supplier: e.supplier?.name || '—',
        amount: Number(e.amount || 0),
      });

      r.height = 22;
      r.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: SLATE_700 } };
        cell.alignment = { vertical: 'middle', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: SLATE_200 } } };
      });

      r.getCell('date').numFmt = 'dd/mm/yyyy';
      r.getCell('amount').numFmt = '"R$"#,##0.00';
      r.getCell('amount').font = { name: 'Calibri', size: 10, bold: true, color: { argb: DANGER } };
      r.getCell('amount').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    }

    if (expenses.length > 0) {
      const totalRowIdx = ws.rowCount + 2;
      ws.mergeCells(totalRowIdx, 1, totalRowIdx, 5);
      const lbl = ws.getCell(totalRowIdx, 1);
      lbl.value = 'Total de despesas';
      lbl.font = { name: 'Calibri', size: 11, bold: true, color: { argb: SLATE_900 } };
      lbl.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };

      const sumCell = ws.getCell(totalRowIdx, 6);
      sumCell.value = { formula: `SUM(F2:F${ws.rowCount - 1})`, result: totalExpenses };
      sumCell.numFmt = '"R$"#,##0.00';
      sumCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: DANGER } };
      sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
      sumCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      sumCell.border = { top: { style: 'medium', color: { argb: DANGER } } };
      ws.getRow(totalRowIdx).height = 30;
    } else {
      ws.addRow([]);
      const r = ws.addRow(['Nenhuma despesa registrada.']);
      r.getCell(1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: SLATE_500 } };
    }

    // unused hint pra evitar warning do linter
    void BRAND;

    await wb.xlsx.write(res);
    res.end();
  }
}
