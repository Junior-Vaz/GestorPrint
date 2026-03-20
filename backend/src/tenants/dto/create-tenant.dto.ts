import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsIn, MaxLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Gráfica Express' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'grafica-express' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  slug: string;

  @ApiProperty({ example: 'PRO', enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'], required: false })
  @IsOptional()
  @IsIn(['FREE', 'BASIC', 'PRO', 'ENTERPRISE'])
  plan?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ownerPhone?: string;
}
