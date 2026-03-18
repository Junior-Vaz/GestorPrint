import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'João Silva', description: 'Nome completo do cliente' })
  name: string;

  @ApiProperty({ example: 'joao@email.com', description: 'E-mail do cliente', required: false })
  email?: string | null;

  @ApiProperty({ example: '(11) 99999-9999', description: 'Telefone de contato', required: false })
  phone?: string | null;

  @ApiProperty({ example: '123.456.789-00', description: 'CPF ou CNPJ do cliente', required: false })
  document?: string | null;

  @ApiProperty({ example: '01001-000', description: 'CEP do cliente', required: false })
  zipCode?: string;

  @ApiProperty({ example: 'Praça da Sé', description: 'Endereço', required: false })
  address?: string;

  @ApiProperty({ example: 'S/N', description: 'Número', required: false })
  number?: string;

  @ApiProperty({ example: 'Sé', description: 'Bairro', required: false })
  neighborhood?: string;

  @ApiProperty({ example: 'São Paulo', description: 'Cidade', required: false })
  city?: string;

  @ApiProperty({ example: 'SP', description: 'UF', required: false })
  state?: string;
}
