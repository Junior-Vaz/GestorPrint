import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsNotEmpty, Min, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePayableDto {
  @ApiProperty({ example: 'Fatura de papel couché A3 — Fábrica XYZ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description: string;

  @ApiProperty({ example: 1200.00 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ required: false, description: 'ID do fornecedor' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  supplierId?: number;

  @ApiProperty({ required: false, example: 'Insumos' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiProperty({ required: false, example: 'Boleto vence dia 15' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
