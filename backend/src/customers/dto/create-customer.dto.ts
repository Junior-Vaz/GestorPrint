import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, Length, Matches } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'João Silva', description: 'Nome completo do cliente' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ example: 'joao@email.com', description: 'E-mail do cliente', required: false })
  @IsEmail()
  @IsOptional()
  email?: string | null;

  @ApiProperty({ example: '(11) 99999-9999', description: 'Telefone de contato', required: false })
  @IsString()
  @IsOptional()
  phone?: string | null;

  @ApiProperty({ example: '123.456.789-00', description: 'CPF ou CNPJ do cliente', required: false })
  @IsString()
  @IsOptional()
  document?: string | null;

  @ApiProperty({ example: '01001-000', description: 'CEP do cliente', required: false })
  @IsString()
  @IsOptional()
  zipCode?: string;

  @ApiProperty({ example: 'Praça da Sé', description: 'Endereço', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'S/N', description: 'Número', required: false })
  @IsString()
  @IsOptional()
  number?: string;

  @ApiProperty({ example: 'Sé', description: 'Bairro', required: false })
  @IsString()
  @IsOptional()
  neighborhood?: string;

  @ApiProperty({ example: 'São Paulo', description: 'Cidade', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'SP', description: 'UF', required: false })
  @IsString()
  @Length(2, 2)
  @IsOptional()
  state?: string;
}
