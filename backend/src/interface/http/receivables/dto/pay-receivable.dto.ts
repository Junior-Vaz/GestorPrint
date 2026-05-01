import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class PayReceivableDto {
  @ApiProperty({ example: 450.00 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paidAmount: number;

  @ApiProperty({ required: false, example: '2026-05-08' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
