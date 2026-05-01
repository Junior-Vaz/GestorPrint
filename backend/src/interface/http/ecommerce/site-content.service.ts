import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Conteúdo gerenciável da loja — slides do hero, depoimentos, FAQs, "Sobre".
 * Tudo mora num único registro `SiteContent` por tenant (com campos JSON).
 */
@Injectable()
export class SiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Retorna o conteúdo (cria registro vazio na primeira chamada). */
  async get(tenantId: number) {
    let content = await (this.prisma as any).siteContent.findUnique({ where: { tenantId } });
    if (!content) {
      content = await (this.prisma as any).siteContent.create({
        data: {
          tenantId,
          slides:       [],
          testimonials: [],
          faqs:         [],
          about:        null,
          legal:        null,
          config:       null,
        },
      });
    }
    // Garante shape mínimo do `legal` mesmo se nunca foi preenchido — assim a SPA
    // sempre tem { returns, privacy, terms } pra ler sem checar undefined.
    if (!content.legal || typeof content.legal !== 'object') {
      content.legal = { returns: null, privacy: null, terms: null };
    }
    return content;
  }

  /** Atualiza por seção (envia só o que mudou; o resto fica como tá). */
  async update(tenantId: number, data: { slides?: any[]; testimonials?: any[]; faqs?: any[]; about?: any; legal?: any; config?: any }) {
    return (this.prisma as any).siteContent.upsert({
      where:  { tenantId },
      create: {
        tenantId,
        slides:       data.slides       || [],
        testimonials: data.testimonials || [],
        faqs:         data.faqs         || [],
        about:        data.about        || null,
        legal:        data.legal        || null,
        config:       data.config       || null,
      },
      update: {
        slides:       data.slides,
        testimonials: data.testimonials,
        faqs:         data.faqs,
        about:        data.about,
        legal:        data.legal,
        config:       data.config,
      },
    });
  }
}
