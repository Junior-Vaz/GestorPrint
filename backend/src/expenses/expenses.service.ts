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

  async create(createExpenseDto: CreateExpenseDto) {
    const expense = await (this.prisma as any).expense.create({
      data: {
        ...createExpenseDto,
        date: createExpenseDto.date ? new Date(createExpenseDto.date) : new Date(),
      },
    });

    // Create System Notification
    await this.notificationsService.create({
      title: 'Nova Despesa / Saída',
      message: `Registrada uma saída de R$ ${createExpenseDto.amount.toFixed(2)}: ${createExpenseDto.description}`,
      type: createExpenseDto.category === 'Sangria' ? 'ALERTA' : 'INFO',
    });

    return expense;
  }

  async findAll() {
    return (this.prisma as any).expense.findMany({
      orderBy: { date: 'desc' },
    });
  }

  async update(id: number, updateExpenseDto: UpdateExpenseDto) {
    return (this.prisma as any).expense.update({
      where: { id },
      data: {
        ...updateExpenseDto,
        date: updateExpenseDto.date ? new Date(updateExpenseDto.date) : undefined,
      },
    });
  }

  async remove(id: number) {
    return (this.prisma as any).expense.delete({
      where: { id },
    });
  }

  // Categories
  async createCategory(name: string) {
    return (this.prisma as any).expenseCategory.create({
      data: { name },
    });
  }

  async findAllCategories() {
    const categories = await (this.prisma as any).expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      // Seed defaults
      const defaults = ['Sangria', 'Insumos', 'Aluguel', 'Salários', 'Energia', 'Marketing', 'Manutenção', 'Impostos', 'Outros'];
      await (this.prisma as any).expenseCategory.createMany({
        data: defaults.map(name => ({ name })),
        skipDuplicates: true,
      });
      return (this.prisma as any).expenseCategory.findMany({ orderBy: { name: 'asc' } });
    }

    return categories;
  }

  async removeCategory(id: number) {
    return (this.prisma as any).expenseCategory.delete({
      where: { id },
    });
  }

  async exportCsv() {
    const expenses = await (this.prisma as any).expense.findMany({
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
