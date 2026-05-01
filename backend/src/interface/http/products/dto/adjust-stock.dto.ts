import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustStockDto {
  @ApiProperty({ example: 50 })
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ enum: ['PURCHASE', 'SALE', 'ADJUSTMENT'] })
  @IsIn(['PURCHASE', 'SALE', 'ADJUSTMENT'])
  type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
