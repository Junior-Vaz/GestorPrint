import { ApiProperty } from '@nestjs/swagger';

export class CreateEstimateDto {
  @ApiProperty({ example: 1, description: 'ID do Cliente' })
  customerId: number;

  @ApiProperty({ example: 'DRAFT', description: 'Status: DRAFT, SENT, APPROVED' })
  status?: string;

  @ApiProperty({ description: 'Dados JSON da calculadora (largura, altura, qtd, etc)' })
  details: any;

  @ApiProperty({ example: 150.50, description: 'Preço total calculado' })
  totalPrice: number;
}
