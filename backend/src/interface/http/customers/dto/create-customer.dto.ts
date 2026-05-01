import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength, ValidateIf, IsDateString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'João Silva', description: 'Nome completo do cliente' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'joao@email.com', description: 'E-mail do cliente', required: false })
  @ValidateIf(o => !!o.email)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiProperty({ example: '(11) 99999-9999', description: 'Telefone de contato', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ApiProperty({ example: '123.456.789-00', description: 'CPF ou CNPJ do cliente', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document?: string | null;

  @ApiProperty({ example: '01001-000', description: 'CEP do cliente', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  zipCode?: string;

  @ApiProperty({ example: 'Praça da Sé', description: 'Endereço', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiProperty({ example: 'S/N', description: 'Número', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  number?: string;

  @ApiProperty({ example: 'Sé', description: 'Bairro', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  neighborhood?: string;

  @ApiProperty({ example: 'São Paulo', description: 'Cidade', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiProperty({ example: 'SP', description: 'UF', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiProperty({ example: 'Apto 12', description: 'Complemento do endereço', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  complement?: string | null;

  @ApiProperty({ example: '/api/files/abc/foto.jpg', description: 'URL da foto/avatar (aceita data URL base64 até ~7MB)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10_000_000)   // ~10MB — cobre data URLs de imagens até 5MB (base64 = +33%)
  photoUrl?: string | null;

  @ApiProperty({ example: '1990-05-20', description: 'Data de nascimento (ISO date)', required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  birthDate?: string | null;

  @ApiProperty({ example: 'Cliente VIP, prefere contato pela manhã', description: 'Observações livres', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
