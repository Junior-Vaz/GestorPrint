import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

@ApiTags('suppliers')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @CanAccess('suppliers', 'create')
  create(@Body() createSupplierDto: CreateSupplierDto, @CurrentTenant() tenantId: number) {
    return this.suppliersService.create(createSupplierDto, tenantId);
  }

  @Get()
  @CanAccess('suppliers', 'view')
  findAll(@CurrentTenant() tenantId: number, @Query() dto: PaginationDto) {
    return this.suppliersService.findAll(tenantId, dto);
  }

  @Get(':id')
  @CanAccess('suppliers', 'view')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.suppliersService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @CanAccess('suppliers', 'edit')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto, @CurrentTenant() tenantId: number) {
    return this.suppliersService.update(+id, updateSupplierDto, tenantId);
  }

  @Delete(':id')
  @CanAccess('suppliers', 'delete')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.suppliersService.remove(+id, tenantId);
  }
}
