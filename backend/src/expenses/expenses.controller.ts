import { Controller, Get, Post, Body, Patch, Param, Delete, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() createExpenseDto: CreateExpenseDto, @CurrentTenant() tenantId: number) {
    return this.expensesService.create(createExpenseDto, tenantId);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.expensesService.findAll(tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto, @CurrentTenant() tenantId: number) {
    return this.expensesService.update(+id, updateExpenseDto, tenantId);
  }

  @Get('export/csv')
  async exportCsv(@Res() res: Response, @CurrentTenant() tenantId: number) {
    const csv = await this.expensesService.exportCsv(tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=despesas.csv');
    return res.send(csv);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.expensesService.remove(+id, tenantId);
  }

  // Categories
  @Get('categories')
  findAllCategories(@CurrentTenant() tenantId: number) {
    return this.expensesService.findAllCategories(tenantId);
  }

  @Post('categories')
  createCategory(@Body() body: { name: string }, @CurrentTenant() tenantId: number) {
    return this.expensesService.createCategory(body.name, tenantId);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.expensesService.removeCategory(+id, tenantId);
  }
}
