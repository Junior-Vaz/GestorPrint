import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@ApiTags('customers')
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar um novo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso.' })
  create(@Body() createCustomerDto: CreateCustomerDto, @CurrentTenant() tenantId: number) {
    return this.customersService.create(createCustomerDto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os clientes' })
  findAll(@CurrentTenant() tenantId: number) {
    return this.customersService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de um cliente' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.customersService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados de um cliente' })
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto, @CurrentTenant() tenantId: number) {
    return this.customersService.update(+id, updateCustomerDto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover um cliente' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.customersService.remove(+id, tenantId);
  }
}
