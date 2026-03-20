import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional, Length, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'João Silva', description: 'Name of the customer' })
  @IsString()
  @Length(1, 255)
  customerName: string;

  @ApiProperty({ example: 'Cartão de Visita - 4x4 - Couchê 300g', description: 'Details about the printing job' })
  @IsString()
  @Length(1, 500)
  productDescription: string;

  @ApiProperty({ example: 150.0, description: 'Total value of the order' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: true, required: false, description: 'Whether this order was created via the Point of Sale interface' })
  @IsBoolean()
  @IsOptional()
  isPdv?: boolean;

  @ApiProperty({ required: false, description: 'JSON details containing cart items or estimate specs' })
  @IsOptional()
  details?: any;

  @ApiProperty({ required: false, description: 'Reference ID of the originating estimate' })
  @IsNumber()
  @IsOptional()
  estimateId?: number;

  @ApiProperty({ example: 'DINHEIRO', required: false, description: 'Payment method for PDV sales' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiProperty({ required: false, description: 'ID of the salesperson' })
  @IsNumber()
  @IsOptional()
  salespersonId?: number;

  @ApiProperty({ required: false, description: 'ID of the producer' })
  @IsNumber()
  @IsOptional()
  producerId?: number;
}
