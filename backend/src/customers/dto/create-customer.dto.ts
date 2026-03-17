import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'João Silva', description: 'Nome completo do cliente' })
  name: string;

  @ApiProperty({ example: 'joao@email.com', description: 'E-mail do cliente', required: false })
  email?: string;

  @ApiProperty({ example: '(11) 99999-9999', description: 'Telefone de contato', required: false })
  phone?: string;

  @ApiProperty({ example: '123.456.789-00', description: 'CPF ou CNPJ do cliente', required: false })
  document?: string;
}
