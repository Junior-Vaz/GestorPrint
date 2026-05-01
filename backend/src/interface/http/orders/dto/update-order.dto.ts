import { PartialType, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn, IsDateString, ValidateIf } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiProperty({ example: 'PRODUCTION', description: 'Current status of the order', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiProperty({ example: '2026-04-30', required: false, description: 'Delivery deadline (ISO date)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  deliveryDate?: string | null;

  @ApiProperty({ example: 'URGENT', required: false, enum: ['NORMAL', 'URGENT'] })
  @IsOptional()
  @IsString()
  @IsIn(['NORMAL', 'URGENT'])
  priority?: string;

  @ApiProperty({
    required: false,
    description: 'Anotações livres do operador (mostradas no card do Kanban)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
