import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantUuid(tenantId: number) {
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { uuid: true },
    });
    return tenant?.uuid ?? '';
  }

  async getSettings(tenantId = 1) {
    return (this.prisma as any).settings.findUnique({ where: { tenantId } });
  }

  updateSettings(data: any, tenantId = 1) {
    return (this.prisma as any).settings.upsert({
      where: { tenantId },
      create: { ...data, tenantId },
      update: data,
    });
  }

  /** Merge incremental do pricingConfig — preserva chaves não enviadas. */
  async updatePricingConfig(patch: any, tenantId = 1) {
    const current = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const existing = (current?.pricingConfig as any) || {};
    const merged = deepMerge(existing, patch || {});
    return (this.prisma as any).settings.upsert({
      where: { tenantId },
      create: { tenantId, pricingConfig: merged },
      update: { pricingConfig: merged },
    });
  }
}

function deepMerge(target: any, source: any): any {
  if (typeof source !== 'object' || source === null) return source;
  const out: any = { ...(target || {}) };
  for (const k of Object.keys(source)) {
    const sv = source[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      out[k] = deepMerge(out[k] || {}, sv);
    } else {
      out[k] = sv;
    }
  }
  return out;
}
