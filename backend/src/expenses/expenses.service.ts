import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { NotificationsService } from '../notifications/notifications.service';

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
      title: 'Nova Despesa / Saída',
      message: `Registrada uma saída de R$ ${createExpenseDto.amount.toFixed(2)}: ${createExpenseDto.description}`,
      type: createExpenseDto.category === 'Sangria' ? 'ALERTA' : 'INFO',
    });

    return expense;
  }

  async findAll(tenantId: number) {
    return (this.prisma as any).expense.findMany({
      where: { tenantId },
      orderBy: { date: 'desc' },
    });
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
}
