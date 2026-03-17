import { Controller, Get, Post, Body, Patch, Param, Delete, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EstimatesService } from './estimates.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';

@Controller('estimates')
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Post()
  create(@Body() createEstimateDto: CreateEstimateDto) {
    return this.estimatesService.create(createEstimateDto);
  }

  @Get()
  findAll() {
    return this.estimatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.estimatesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEstimateDto: UpdateEstimateDto) {
    return this.estimatesService.update(+id, updateEstimateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.estimatesService.remove(+id);
  }

  @Post(':id/convert')
  convert(@Param('id') id: string) {
    return this.estimatesService.convertToOrder(+id);
  }

  @Post(':id/payment')
  getPayment(@Param('id') id: string) {
    return this.estimatesService.getPayment(+id);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=orcamento.pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    await this.estimatesService.generatePdf(+id, res);
  }
}
