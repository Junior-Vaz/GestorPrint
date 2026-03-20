import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto, @CurrentTenant() tenantId: number) {
    return this.productsService.create(createProductDto, tenantId);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.productsService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.productsService.findOne(+id, tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @CurrentTenant() tenantId: number) {
    return this.productsService.update(+id, updateProductDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.productsService.remove(+id, tenantId);
  }

  @Post(':id/stock')
  adjustStock(
    @Param('id') id: string,
    @Body() body: AdjustStockDto,
  ) {
    return this.productsService.updateStock(+id, body.quantity, body.type, body.reason);
  }
}
