import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Ensure at least one settings record exists
    const count = await this.prisma.settings.count();
    if (count === 0) {
      await this.prisma.settings.create({
        data: {
          id: 1,
          companyName: 'Minha Gráfica',
          cnpj: '00.000.000/0001-00',
          phone: '(00) 0000-0000',
          email: 'contato@grafica.com.br',
          address: 'Rua das Gráficas, 123 - Centro'
        }
      });
    }
  }

  getSettings() {
    return this.prisma.settings.findUnique({
      where: { id: 1 }
    });
  }

  updateSettings(data: any) {
    return this.prisma.settings.update({
      where: { id: 1 },
      data
    });
  }
}
