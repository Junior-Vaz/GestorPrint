import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

@ApiTags('products')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @CanAccess('products', 'create')
  create(@Body() createProductDto: CreateProductDto, @CurrentTenant() tenantId: number) {
    return this.productsService.create(createProductDto, tenantId);
  }

  @Get()
  @CanAccess('products', 'view')
  findAll(@CurrentTenant() tenantId: number, @Query() dto: PaginationDto) {
    return this.productsService.findAll(tenantId, dto);
  }

  @Get(':id')
  @CanAccess('products', 'view')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.productsService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @CanAccess('products', 'edit')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @CurrentTenant() tenantId: number) {
    return this.productsService.update(+id, updateProductDto, tenantId);
  }

  @Delete(':id')
  @CanAccess('products', 'delete')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.productsService.remove(+id, tenantId);
  }

  @Post(':id/stock')
  @CanAccess('products', 'edit')
  adjustStock(
    @Param('id') id: string,
    @Body() body: AdjustStockDto,
    @CurrentTenant() tenantId: number,
  ) {
    return this.productsService.updateStock(+id, body.quantity, body.type, tenantId, body.reason);
  }
}
