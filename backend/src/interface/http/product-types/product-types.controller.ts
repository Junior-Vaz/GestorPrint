import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductTypesService } from './product-types.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';

@ApiTags('product-types')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('product-types')
export class ProductTypesController {
  constructor(private readonly service: ProductTypesService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.service.findAll(tenantId);
  }

  @Post()
  create(@Body() body: CreateProductTypeDto, @CurrentTenant() tenantId: number) {
    return this.service.create(body, tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateProductTypeDto, @CurrentTenant() tenantId: number) {
    return this.service.update(+id, body, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.service.remove(+id, tenantId);
  }

  @Post('seed')
  seed(@CurrentTenant() tenantId: number) {
    return this.service.seedDefaults(tenantId);
  }
}
