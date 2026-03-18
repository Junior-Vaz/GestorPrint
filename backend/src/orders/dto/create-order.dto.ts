import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'João Silva', description: 'Name of the customer' })
  customerName: string;

  @ApiProperty({ example: 'Cartão de Visita - 4x4 - Couchê 300g', description: 'Details about the printing job' })
  productDescription: string;

  @ApiProperty({ example: 150.0, description: 'Total value of the order' })
  amount: number;

  @ApiProperty({ example: true, required: false, description: 'Whether this order was created via the Point of Sale interface' })
  isPdv?: boolean;

  @ApiProperty({ required: false, description: 'JSON details containing cart items or estimate specs' })
  details?: any;

  @ApiProperty({ required: false, description: 'Reference ID of the originating estimate' })
  estimateId?: number;

  @ApiProperty({ example: 'DINHEIRO', required: false, description: 'Payment method for PDV sales' })
  paymentMethod?: string;

  @ApiProperty({ required: false, description: 'ID of the salesperson' })
  salespersonId?: number;

  @ApiProperty({ required: false, description: 'ID of the producer' })
  producerId?: number;
}
