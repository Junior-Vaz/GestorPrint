import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductTypesService } from './product-types.service';

@Controller('product-types')
export class ProductTypesController {
  constructor(private readonly service: ProductTypesService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Post()
  create(@Body() body: { name: string; color?: string; hasStock?: boolean }) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; color?: string; hasStock?: boolean }) {
    return this.service.update(+id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  @Post('seed')
  seed() { return this.service.seedDefaults(); }
}
