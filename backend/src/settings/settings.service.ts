import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly uploadPath = path.join(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Ensure default tenant settings exist
    const count = await (this.prisma as any).settings.count({ where: { tenantId: 1 } });
    if (count === 0) {
      await (this.prisma as any).settings.create({
        data: {
          tenantId: 1,
          companyName: 'Minha Gráfica',
          cnpj: '00.000.000/0001-00',
          phone: '(00) 0000-0000',
          email: 'contato@grafica.com.br',
          address: 'Rua das Gráficas, 123 - Centro'
        }
      });
    }
  }

  async getSettings(tenantId = 1) {
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    if (settings?.logoUrl) {
      const filename = settings.logoUrl.split('/').pop();
      const filePath = path.join(this.uploadPath, filename || '');
      if (!fs.existsSync(filePath)) {
        await (this.prisma as any).settings.update({ where: { tenantId }, data: { logoUrl: null } });
        return { ...settings, logoUrl: null };
      }
    }
    return settings;
  }

  updateSettings(data: any, tenantId = 1) {
    return (this.prisma as any).settings.upsert({
      where: { tenantId },
      create: { ...data, tenantId },
      update: data,
    });
  }
}
