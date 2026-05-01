import { Controller, Get, Post, Body, Patch, Param, Delete, Res, UseGuards, Query, Req } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';

@ApiTags('orders')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @CanAccess('orders-board', 'create')
  @ApiOperation({ summary: 'Create a new printing order (Emits WebSocket event)' })
  @ApiResponse({ status: 201, description: 'The order has been successfully created.', type: Object })
  create(@Body() createOrderDto: CreateOrderDto, @CurrentTenant() tenantId: number) {
    return this.ordersService.create(createOrderDto, tenantId);
  }

  @Get()
  @CanAccess('orders-board', 'view')
  @ApiOperation({ summary: 'List all running orders' })
  @ApiResponse({ status: 200, description: 'Return all orders.', type: [Object] })
  findAll(@CurrentTenant() tenantId: number, @Query() dto: any) {
    if (dto.page || dto.limit || dto.search || dto.status) {
      return this.ordersService.findAllPaginated(tenantId, dto);
    }
    return this.ordersService.findAll(tenantId);
  }

  @Get(':id')
  @CanAccess('orders-board', 'view')
  @ApiOperation({ summary: 'Get order details by ID' })
  @ApiResponse({ status: 200, description: 'Return order details.', type: Object })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.ordersService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @CanAccess('orders-board', 'edit')
  @RequireFeature(FeatureKey.KANBAN_BOARD)
  @ApiOperation({ summary: 'Update an order (e.g. change status to PRODUCTION)' })
  @ApiResponse({ status: 200, description: 'The order has been successfully updated.', type: Object })
  update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentTenant() tenantId: number,
    @Req() req: any,
  ) {
    return this.ordersService.update(+id, updateOrderDto, tenantId, req?.user?.id);
  }

  @Delete(':id')
  @CanAccess('orders-board', 'delete')
  @ApiOperation({ summary: 'Delete an order' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number, @Req() req: any) {
    return this.ordersService.remove(+id, tenantId, req?.user?.id);
  }

  @Get(':id/receipt')
  @CanAccess('orders-board', 'view')
  @RequireFeature(FeatureKey.PDF_GENERATION)
  @ApiOperation({ summary: 'Generate 2-copy receipt PDF' })
  async generateReceipt(@Param('id') id: string, @Res() res: any, @CurrentTenant() tenantId: number) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=recibo_pedido_${id}.pdf`);
    return this.ordersService.generateReceipt(+id, res, tenantId);
  }
}
