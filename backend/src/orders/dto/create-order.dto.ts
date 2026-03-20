import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, Min, MaxLength, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @ApiProperty({ example: 'João Silva', description: 'Name of the customer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  customerName: string;

  @ApiProperty({ example: 'Cartão de Visita - 4x4 - Couchê 300g', description: 'Details about the printing job' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  productDescription: string;

  @ApiProperty({ example: 150.0, description: 'Total value of the order' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: true, required: false, description: 'Whether this order was created via the Point of Sale interface' })
  @IsOptional()
  @IsBoolean()
  isPdv?: boolean;

  @ApiProperty({ required: false, description: 'JSON details containing cart items or estimate specs' })
  @IsOptional()
  details?: any;

  @ApiProperty({ required: false, description: 'Reference ID of the originating estimate' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  estimateId?: number;

  @ApiProperty({ example: 'DINHEIRO', required: false, description: 'Payment method for PDV sales' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  paymentMethod?: string;

  @ApiProperty({ required: false, description: 'ID of the salesperson' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  salespersonId?: number;

  @ApiProperty({ required: false, description: 'ID of the producer' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  producerId?: number;
}
