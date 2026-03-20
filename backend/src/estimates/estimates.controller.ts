import { Controller, Get, Post, Body, Patch, Param, Delete, Header, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { EstimatesService } from './estimates.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('estimates')
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Post()
  create(@Body() createEstimateDto: CreateEstimateDto, @CurrentTenant() tenantId: number) {
    return this.estimatesService.create(createEstimateDto, tenantId);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.estimatesService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.estimatesService.findOne(+id, tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEstimateDto: UpdateEstimateDto, @CurrentTenant() tenantId: number) {
    return this.estimatesService.update(+id, updateEstimateDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.estimatesService.remove(+id, tenantId);
  }

  @Post(':id/convert')
  convert(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.estimatesService.convertToOrder(+id, tenantId);
  }

  @Post(':id/payment')
  getPayment(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.estimatesService.getPayment(+id, tenantId);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=orcamento.pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response, @CurrentTenant() tenantId: number) {
    await this.estimatesService.generatePdf(+id, res, tenantId);
  }
}
