import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength, ValidateIf } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Papel Brasil Ltda' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ required: false })
  @ValidateIf(o => !!o.email)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}
