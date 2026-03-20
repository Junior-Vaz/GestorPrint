import { IsString, IsEmail, IsOptional, Length } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
