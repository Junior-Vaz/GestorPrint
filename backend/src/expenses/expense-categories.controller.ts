import { Controller, Get, Post, Body, Delete, Param, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body('name') name: string, @CurrentTenant() tenantId: number) {
    return this.expensesService.createCategory(name, tenantId);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.expensesService.findAllCategories(tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.expensesService.removeCategory(+id, tenantId);
  }
}
