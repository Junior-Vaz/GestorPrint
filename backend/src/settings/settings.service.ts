import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly uploadPath = path.join(process.cwd(), 'uploads');

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

  async getSettings() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.logoUrl) {
      const filename = settings.logoUrl.split('/').pop();
      const filePath = path.join(this.uploadPath, filename || '');
      if (!fs.existsSync(filePath)) {
        // File lost (e.g. volume reset) — clear stale URL so frontend doesn't get 404
        await this.prisma.settings.update({ where: { id: 1 }, data: { logoUrl: null } });
        return { ...settings, logoUrl: null };
      }
    }
    return settings;
  }

  updateSettings(data: any) {
    return this.prisma.settings.update({
      where: { id: 1 },
      data
    });
  }
}
