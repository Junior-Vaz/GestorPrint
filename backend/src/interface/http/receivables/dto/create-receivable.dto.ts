import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsNotEmpty, Min, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReceivableDto {
  @ApiProperty({ example: 'Serviço de impressão banner 3x1m' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description: string;

  @ApiProperty({ example: 450.00 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: '2026-05-10' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ description: 'ID do cliente' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  customerId: number;

  @ApiProperty({ required: false, description: 'ID do pedido vinculado' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  orderId?: number;

  @ApiProperty({ required: false, example: 'Pagamento em 30 dias conforme combinado' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
