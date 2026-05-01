import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, IsArray, IsIn } from 'class-validator';

export class CreateProductTypeDto {
  @ApiProperty({ example: 'Papel / Mídia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: '#f59e0b', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  hasStock?: boolean;

  @ApiProperty({ example: ['service', 'plotter'], required: false, description: 'Calculadoras onde este tipo aparece. Vazio = todas.' })
  @IsOptional()
  @IsArray()
  @IsIn(['service', 'plotter', 'cutting', 'embroidery'], { each: true })
  applicableEstimateTypes?: string[];
}
