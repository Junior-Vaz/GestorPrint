import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

@ApiTags('customers')
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @CanAccess('customers', 'create')
  @ApiOperation({ summary: 'Cadastrar um novo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso.' })
  create(@Body() createCustomerDto: CreateCustomerDto, @CurrentTenant() tenantId: number) {
    return this.customersService.create(createCustomerDto, tenantId);
  }

  @Get()
  @CanAccess('customers', 'view')
  @ApiOperation({ summary: 'Listar todos os clientes' })
  findAll(@CurrentTenant() tenantId: number, @Query() dto: PaginationDto) {
    return this.customersService.findAll(tenantId, dto);
  }

  @Get(':id')
  @CanAccess('customers', 'view')
  @ApiOperation({ summary: 'Obter detalhes de um cliente' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.customersService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @CanAccess('customers', 'edit')
  @ApiOperation({ summary: 'Atualizar dados de um cliente' })
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto, @CurrentTenant() tenantId: number) {
    return this.customersService.update(+id, updateCustomerDto, tenantId);
  }

  @Delete(':id')
  @CanAccess('customers', 'delete')
  @ApiOperation({ summary: 'Remover um cliente' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.customersService.remove(+id, tenantId);
  }
}
