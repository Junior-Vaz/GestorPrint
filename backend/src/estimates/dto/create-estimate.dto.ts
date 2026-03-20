import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, IsString, IsObject, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEstimateDto {
  @ApiProperty({ example: 1, description: 'ID do Cliente' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  customerId: number;

  @ApiProperty({ example: 'DRAFT', description: 'Status: DRAFT, SENT, APPROVED', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ description: 'Dados JSON da calculadora (largura, altura, qtd, etc)' })
  @IsObject()
  details: any;

  @ApiProperty({ example: 150.50, description: 'Preço total calculado' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalPrice: number;

  @ApiProperty({ required: false, description: 'ID do vendedor' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  salespersonId?: number;
}
