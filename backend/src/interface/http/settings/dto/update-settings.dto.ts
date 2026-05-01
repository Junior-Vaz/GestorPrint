import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsBoolean, IsNumber, MaxLength, ValidateIf, IsArray, ArrayMaxSize, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnpj?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ required: false })
  @ValidateIf(o => !!o.email)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  smtpPort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpPass?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mpAccessToken?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mpPublicKey?: string;

  // ── Dados de negócio expostos pra IA ────────────────────────────────────
  // Esses campos alimentam variáveis de prompt ({{paymentMethods}}, etc) e
  // a tool get_business_info usada pelos dois agentes IA.

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  paymentMethods?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  businessHours?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  @Type(() => Number)
  defaultDeliveryDays?: number;
}
