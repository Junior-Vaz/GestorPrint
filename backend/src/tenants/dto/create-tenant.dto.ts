import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsInt, IsIn, IsISO8601, Min, Max, MaxLength, ValidateIf, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenantDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(60)
  slug: string;

  @IsOptional() @IsString() @MaxLength(30)
  plan?: string;

  @IsOptional() @IsIn(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'])
  planStatus?: string;

  @IsOptional() @IsISO8601()
  trialEndsAt?: string;

  @IsOptional() @IsISO8601()
  planExpiresAt?: string;

  @IsOptional() @IsInt() @Min(1) @Max(99999) @Type(() => Number)
  maxUsers?: number;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  maxOrders?: number;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  maxCustomers?: number;

  @IsOptional() @IsString() @MaxLength(120)
  ownerName?: string;

  @ValidateIf(o => !!o.ownerEmail)
  @IsOptional() @IsEmail()
  ownerEmail?: string;

  @IsOptional() @IsString() @MaxLength(20)
  ownerPhone?: string;

  @IsOptional() @Matches(/^\d{11}$|^\d{14}$/, { message: 'cpfCnpj deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ), apenas números' })
  cpfCnpj?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
