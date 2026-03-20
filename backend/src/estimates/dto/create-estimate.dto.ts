import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min, IsIn } from 'class-validator';

export class CreateEstimateDto {
  @ApiProperty({ example: 1, description: 'ID do Cliente' })
  @IsNumber()
  @Min(1)
  customerId: number;

  @ApiProperty({ example: 'DRAFT', description: 'Status: DRAFT, SENT, APPROVED' })
  @IsString()
  @IsIn(['DRAFT', 'SENT', 'APPROVED', 'REJECTED'])
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Dados JSON da calculadora (largura, altura, qtd, etc)' })
  details: any;

  @ApiProperty({ example: 150.50, description: 'Preço total calculado' })
  @IsNumber()
  @Min(0)
  totalPrice: number;
}
