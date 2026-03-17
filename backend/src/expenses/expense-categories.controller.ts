import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body('name') name: string) {
    return this.expensesService.createCategory(name);
  }

  @Get()
  findAll() {
    return this.expensesService.findAllCategories();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.removeCategory(+id);
  }
}
