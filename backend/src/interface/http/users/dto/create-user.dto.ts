import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsNumber, IsBoolean, IsIn, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria Operadora' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'maria@gestorprint.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;

  @ApiProperty({ example: 'SALES', enum: ['ADMIN', 'SALES', 'PRODUCTION', 'VIEWER'] })
  @IsOptional()
  @IsIn(['ADMIN', 'SALES', 'PRODUCTION', 'VIEWER'])
  role?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  commissionRate?: number;

  @ApiProperty({ example: 2500, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salary?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, description: 'Avatar do usuário (data URL ou /api/files/...)' })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
