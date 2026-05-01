import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class EcommerceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Slugify simples — minúsculas, sem acento, hífen */
  static slugify(s: string): string {
    return (s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);
  }

  /** Garante slug único — sufixa -2, -3 se colidir */
  async ensureUniqueSlug(base: string, excludeProductId?: number): Promise<string> {
    const baseSlug = EcommerceService.slugify(base);
    if (!baseSlug) return `produto-${Date.now()}`;
    let slug = baseSlug;
    let i = 1;
    while (true) {
      const existing = await (this.prisma as any).product.findFirst({
        where: { slug, NOT: excludeProductId ? { id: excludeProductId } : undefined },
        select: { id: true },
      });
      if (!existing) return slug;
      i += 1;
      slug = `${baseSlug}-${i}`;
      if (i > 50) return `${baseSlug}-${Date.now()}`;
    }
  }

  // ── Catálogo público ──────────────────────────────────────────────────────
  async listPublicProducts(
    tenantId: number,
    filters: { category?: string; search?: string } = {},
    page = 1,
    pageSize = 24,
  ) {
    const where: any = {
      tenantId,
      visibleInStore: true,
      productType: { visibleInStore: true },
    };
    if (filters.category) where.productType = { ...where.productType, name: { equals: filters.category, mode: 'insensitive' } };
    if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };

    // Bounds — protege contra request maliciosa
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 24));
    const skip = (safePage - 1) * safeSize;

    const [products, total] = await Promise.all([
      (this.prisma as any).product.findMany({
        where,
        include: { productType: { select: { id: true, name: true, color: true, storeIcon: true } } },
        orderBy: [{ storeOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: safeSize,
      }),
      (this.prisma as any).product.count({ where }),
    ]);

    // Agrega rating + count por produto numa única query (evita N+1)
    const productIds = products.map((p: any) => p.id);
    const reviewStats = productIds.length
      ? await (this.prisma as any).review.groupBy({
          by: ['productId'],
          where: { tenantId, status: 'PUBLISHED', productId: { in: productIds } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : [];
    const statsByProductId = new Map(
      reviewStats.map((s: any) => [
        s.productId,
        {
          rating: s._avg?.rating ? Math.round(s._avg.rating * 10) / 10 : null,
          reviewCount: s._count?._all || 0,
        },
      ]),
    );

    const data = products.map((p: any) => {
      const stats = (statsByProductId.get(p.id) as { rating: number | null; reviewCount: number } | undefined) || { rating: null, reviewCount: 0 };
      // Preço efetivo na loja: storePrice se definido, senão unitPrice (preço interno padrão)
      const effectivePrice = (p.storePrice != null && p.storePrice > 0) ? Number(p.storePrice) : Number(p.unitPrice);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        photos: p.photos || [],
        unitPrice: effectivePrice,
        unit: p.unit,
        stock: p.stock,
        pixDiscountPercent: Number(p.pixDiscountPercent ?? 0),
        originalPrice:      p.originalPrice ? Number(p.originalPrice) : null,
        category: p.productType?.name,
        categoryColor: p.productType?.color,
        rating:      stats.rating,
        reviewCount: stats.reviewCount,
      };
    });
    return { data, total, page: safePage, pageSize: safeSize };
  }

  // Estatísticas da loja exibidas no PDP (substituem números hardcoded)
  async getStoreStats(tenantId: number) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalOrders, last24hOrders] = await Promise.all([
      // Pedidos finalizados (qualquer fonte) — pra "+N pedidos realizados"
      (this.prisma as any).order.count({
        where: { tenantId, status: { in: ['DELIVERED', 'FINISHED', 'PRODUCTION'] } },
      }),
      // Pedidos da loja nas últimas 24h — pra "X pedidos nas últimas 24h"
      (this.prisma as any).order.count({
        where: { tenantId, source: 'ECOMMERCE', createdAt: { gte: since24h } },
      }),
    ]);
    return { totalOrders, last24hOrders };
  }

  async getPublicProduct(tenantId: number, slug: string) {
    const product = await (this.prisma as any).product.findFirst({
      where: { tenantId, slug, visibleInStore: true },
      include: { productType: { select: { id: true, name: true, color: true } } },
    });
    if (!product) return null;

    // Agrega rating + count de reviews publicados (sem buscar list aqui — endpoint separado)
    const [reviewAgg, reviewCount] = await Promise.all([
      (this.prisma as any).review.aggregate({
        where: { tenantId, productId: product.id, status: 'PUBLISHED' },
        _avg: { rating: true },
      }),
      (this.prisma as any).review.count({
        where: { tenantId, productId: product.id, status: 'PUBLISHED' },
      }),
    ]);
    const avgRating = reviewAgg?._avg?.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : null;

    // Preço efetivo na loja: storePrice se definido, senão unitPrice (preço interno padrão)
    const effectivePrice = (product.storePrice != null && product.storePrice > 0) ? Number(product.storePrice) : Number(product.unitPrice);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      longDescription: product.longDescription,
      photos: product.photos || [],
      unitPrice: effectivePrice,
      unit: product.unit,
      stock: product.stock,
      weightGrams: product.weightGrams,
      heightCm: product.heightCm,
      widthCm: product.widthCm,
      lengthCm: product.lengthCm,
      pixDiscountPercent: Number(product.pixDiscountPercent ?? 0),
      originalPrice:      product.originalPrice ? Number(product.originalPrice) : null,
      productionDays:     Number(product.productionDays ?? 0),
      category: product.productType?.name,
      categoryColor: product.productType?.color,
      reviewCount,
      rating: avgRating,
    };
  }

  async listPublicCategories(tenantId: number) {
    return (this.prisma as any).productType.findMany({
      where: { tenantId, visibleInStore: true },
      select: { id: true, name: true, color: true, storeIcon: true, storeOrder: true },
      orderBy: [{ storeOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // ── Admin ──────────────────────────────────────────────────────────────────
  async updateProductStore(productId: number, tenantId: number, data: any) {
    const product = await (this.prisma as any).product.findFirst({
      where: { id: productId, tenantId },
      include: { productType: { select: { id: true, visibleInStore: true } } },
    });
    if (!product) throw new Error('Produto não encontrado');

    // Se ativando visibilidade e não tem slug, gera
    if (data.visibleInStore && !data.slug && !product.slug) {
      data.slug = await this.ensureUniqueSlug(product.name, productId);
    }

    // Smart default: ao ativar visibilidade, garante que a categoria
    // do produto também esteja visível (senão o filtro público o esconde).
    // updateMany c/ tenantId protege contra cross-tenant write (se a categoria
    // for de outro tenant — improvável dado o include acima, mas defesa em camadas).
    if (data.visibleInStore && product.productType && !product.productType.visibleInStore) {
      await (this.prisma as any).productType.updateMany({
        where: { id: product.productType.id, tenantId },
        data:  { visibleInStore: true },
      });
    }

    // updateMany ancora o filtro de tenant — sem isso, um operador de tenant A
    // poderia editar produtos de tenant B forjando o productId no path param.
    const result = await (this.prisma as any).product.updateMany({
      where: { id: productId, tenantId },
      data,
    });
    if (result.count === 0) throw new Error('Produto não encontrado');
    return (this.prisma as any).product.findUnique({ where: { id: productId } });
  }

  async updateCategoryStore(categoryId: number, tenantId: number, data: any) {
    // updateMany c/ tenantId — `update` por id sozinho permitiria editar
    // categorias de outro tenant (mesma vulnerabilidade do updateProductStore).
    const result = await (this.prisma as any).productType.updateMany({
      where: { id: categoryId, tenantId },
      data,
    });
    if (result.count === 0) throw new Error('Categoria não encontrada');
    return (this.prisma as any).productType.findUnique({ where: { id: categoryId } });
  }

  /** Produtos com estoque ≤ minStock — pra alerta de reposição */
  async listStockAlerts(tenantId: number) {
    // Filtro feito no Prisma com `stockMinusMin`: tem que ser via raw porque Prisma não suporta
    // comparação coluna vs coluna ainda. Usamos $queryRaw.
    const rows = await (this.prisma as any).$queryRaw`
      SELECT p.id, p.name, p.slug, p.stock, p."minStock", p."unitPrice", p.unit, p."visibleInStore", p.photos,
             pt.name AS "categoryName", pt.color AS "categoryColor"
      FROM "Product" p
      LEFT JOIN "ProductType" pt ON pt.id = p."typeId"
      WHERE p."tenantId" = ${tenantId}
        AND p."minStock" > 0
        AND p.stock <= p."minStock"
      ORDER BY p.stock ASC, p.name ASC
    `;
    return rows;
  }

  async listAdminProducts(tenantId: number, page = 1, pageSize = 50) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(200, Math.max(10, Math.floor(pageSize) || 50));
    const skip = (safePage - 1) * safeSize;
    const where = { tenantId };

    const [data, total] = await Promise.all([
      (this.prisma as any).product.findMany({
        where,
        include: { productType: { select: { id: true, name: true, color: true, visibleInStore: true } } },
        orderBy: [{ storeOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: safeSize,
      }),
      (this.prisma as any).product.count({ where }),
    ]);
    return { data, total, page: safePage, pageSize: safeSize };
  }

  // ── Resolução de tenant por domínio (usado no bootstrap da SPA) ─────────────
  /**
   * Resolve tenantId pelo hostname da loja. Sem fallback intencional: se o domínio
   * não foi cadastrado pelo admin no ERP, a SPA precisa exibir uma tela de erro
   * — não queremos cair silenciosamente num tenant default e vazar dados de outro.
   *
   * Aceita também o storeDomain com porta (ex: "loja.x.com:8080") — o admin pode
   * cadastrar com ou sem porta; tentamos os dois.
   */
  async resolveTenantByDomain(host: string): Promise<{ tenantId: number; storeName: string } | null> {
    if (!host) return null;
    const cleanHost = host.trim().toLowerCase();
    const hostNoPort = cleanHost.split(':')[0];

    // Tenta exato primeiro, depois sem porta
    const tenant = await (this.prisma as any).tenant.findFirst({
      where: {
        OR: [
          { storeDomain: cleanHost },
          { storeDomain: hostNoPort },
        ],
        isActive: true,
      },
      select: { id: true, name: true, planStatus: true },
    });
    if (!tenant) return null;
    if (tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'CANCELLED') return null;

    // Pega o nome da loja do storeConfig se preenchido (mais fiel ao branding)
    const settings = await (this.prisma as any).settings.findUnique({
      where: { tenantId: tenant.id },
      select: { storeConfig: true, companyName: true },
    });
    const storeName = settings?.storeConfig?.storeName || settings?.companyName || tenant.name;

    return { tenantId: tenant.id, storeName };
  }

  // ── Settings públicas (consumidas pela SPA da loja) ─────────────────────────
  async getPublicStoreSettings(tenantId: number) {
    const all = await this.getStoreSettings(tenantId);
    return {
      storeName:          all.storeConfig.storeName,
      storeDescription:   all.storeConfig.storeDescription,
      publicEmail:        all.storeConfig.publicEmail,
      publicPhone:        all.storeConfig.publicPhone,
      whatsapp:           all.storeConfig.whatsapp,
      publicAddress:      all.storeConfig.publicAddress,
      publicHours:        all.storeConfig.publicHours,
      instagramUrl:       all.storeConfig.instagramUrl,
      facebookUrl:        all.storeConfig.facebookUrl,
      paymentMethods:     all.storeConfig.paymentMethods,
      returnDays:         all.storeConfig.returnDays,
      allowGuestCheckout: all.storeConfig.allowGuestCheckout,
      blockOutOfStock:    all.storeConfig.blockOutOfStock,
      primaryColor:       all.storeConfig.primaryColor,
      promoBanner:        all.storeConfig.promoBanner,
      businessHours:      all.storeConfig.businessHours,
      pickupEnabled:      all.storeConfig.pickupEnabled,
      pickupAddress:      all.storeConfig.pickupAddress,
      pickupInstructions: all.storeConfig.pickupInstructions,
      // Modo férias — quando ativo, SPA mostra banner e desabilita checkout
      vacationMode:       all.storeConfig.vacationMode === true,
      vacationMessage:    all.storeConfig.vacationMessage || '',
      vacationReturnsAt:  all.storeConfig.vacationReturnsAt || null,
      // Logo da loja — mesmo arquivo usado em PDFs/orçamentos (top-level no Settings,
      // fora de storeConfig). A SPA renderiza no header/footer; sem isso, mostra
      // só a marca de 4 quadrados CMYK como fallback genérico.
      logoUrl:            all.logoUrl || '',
      // Public Key do MP — necessária pra o SDK frontend tokenizar cartão (PCI safe).
      // É pública por design; ≠ Access Token (que NÃO é exposto).
      mpPublicKey:        all.mpPublicKey || '',
    };
  }

  // ── Settings da loja ────────────────────────────────────────────────────────
  async getStoreSettings(tenantId: number) {
    const s = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    if (!s) return this.defaultStoreSettings();
    return {
      // Origem do envio
      originCep:     s.originCep || '',
      originAddress: s.originAddress || {},
      // Melhor Envios
      meAccessToken: s.meAccessToken || '',
      meEnvironment: s.meEnvironment || 'sandbox',
      // Mercado Pago (já existem campos legados)
      mpAccessToken:   s.mpAccessToken || '',
      mpPublicKey:     s.mpPublicKey || '',
      mpWebhookSecret: s.mpWebhookSecret || '',
      // Logo top-level (mesmo arquivo usado em PDFs de orçamento/relatório).
      // Editado em ERP → Configurações (não em Ecommerce → Configurações), mas
      // a SPA da loja precisa pra renderizar no header/footer.
      logoUrl:         s.logoUrl || '',
      // Configuração da loja (storeConfig em JSON — flexível)
      storeConfig: {
        // defaults se ainda não configurado
        storeName:        s.storeConfig?.storeName        ?? s.companyName ?? '',
        storeDescription: s.storeConfig?.storeDescription ?? '',
        publicEmail:      s.storeConfig?.publicEmail      ?? s.email ?? '',
        publicPhone:      s.storeConfig?.publicPhone      ?? s.phone ?? '',
        whatsapp:         s.storeConfig?.whatsapp         ?? '',
        // Contato extra
        publicAddress:    s.storeConfig?.publicAddress    ?? s.address ?? '',
        publicHours:      s.storeConfig?.publicHours      ?? '',
        instagramUrl:     s.storeConfig?.instagramUrl     ?? '',
        facebookUrl:      s.storeConfig?.facebookUrl      ?? '',
        // Métodos de pagamento aceitos
        paymentMethods: {
          pix:     s.storeConfig?.paymentMethods?.pix     ?? true,
          card:    s.storeConfig?.paymentMethods?.card    ?? true,
          boleto:  s.storeConfig?.paymentMethods?.boleto  ?? true,
        },
        // Banner promocional global (topo de toda página da loja). Cliente
        // pode desligar/editar pelo ERP. Schema: { enabled, text, link?, color? }.
        promoBanner: {
          enabled: !!s.storeConfig?.promoBanner?.enabled,
          text:    String(s.storeConfig?.promoBanner?.text ?? ''),
          link:    String(s.storeConfig?.promoBanner?.link ?? ''),
          color:   String(s.storeConfig?.promoBanner?.color ?? '#0f172a'),
        },
        // Política
        returnDays:       s.storeConfig?.returnDays       ?? 7,
        // Estoque
        blockOutOfStock:  s.storeConfig?.blockOutOfStock  ?? true,
        // Visitor checkout (compra sem login)
        allowGuestCheckout: s.storeConfig?.allowGuestCheckout ?? true,
        // Visual
        primaryColor:     s.storeConfig?.primaryColor     ?? '#1D9E75',
        // Retirada na loja — quando habilitado, aparece como primeira opção na
        // listagem de fretes do checkout (R$ 0, dias 0). pickupAddress é texto
        // livre exibido pro cliente final ("Av. X, 123 — entre às 9h e 18h").
        pickupEnabled:      !!s.storeConfig?.pickupEnabled,
        pickupAddress:      String(s.storeConfig?.pickupAddress      ?? ''),
        pickupInstructions: String(s.storeConfig?.pickupInstructions ?? ''),
        // CPF do responsável legal — exigido pelo Melhor Envios pra emitir
        // etiqueta de envio quando o tenant é PJ (settings.cnpj com 14 dígitos).
        // Não é exposto publicamente (não vai pro getPublicStoreSettings).
        responsibleCpf:     String(s.storeConfig?.responsibleCpf     ?? ''),
        // Horário de atendimento estruturado — pra "Online agora" no botão do WhatsApp.
        // Schema: { enabled, schedule: [{ day: 0-6, open: "HH:MM", close: "HH:MM" }],
        //   timezone: string }. day=0 é domingo, day=6 é sábado. Múltiplas faixas
        //   por dia permitidas (ex: 12:00-14:00 fechado pra almoço → 2 entradas).
        businessHours: {
          enabled:  !!s.storeConfig?.businessHours?.enabled,
          timezone: String(s.storeConfig?.businessHours?.timezone ?? 'America/Sao_Paulo'),
          schedule: Array.isArray(s.storeConfig?.businessHours?.schedule)
            ? s.storeConfig.businessHours.schedule
            : [],
        },
        // Modo férias — pausa a loja sem despublicar produtos
        vacationMode:      !!s.storeConfig?.vacationMode,
        vacationMessage:   String(s.storeConfig?.vacationMessage   ?? ''),
        vacationReturnsAt: String(s.storeConfig?.vacationReturnsAt ?? ''),
      },
    };
  }

  private defaultStoreSettings() {
    return {
      originCep: '', originAddress: {},
      meAccessToken: '', meEnvironment: 'sandbox',
      mpAccessToken: '', mpPublicKey: '', mpWebhookSecret: '',
      logoUrl: '',
      storeConfig: {
        storeName: '', storeDescription: '',
        publicEmail: '', publicPhone: '', whatsapp: '',
        publicAddress: '', publicHours: '', instagramUrl: '', facebookUrl: '',
        paymentMethods: { pix: true, card: true, boleto: true },
        promoBanner: { enabled: false, text: '', link: '', color: '#0f172a' },
        returnDays: 7, blockOutOfStock: true,
        allowGuestCheckout: true, primaryColor: '#1D9E75',
        pickupEnabled: false, pickupAddress: '', pickupInstructions: '',
        responsibleCpf: '',
        businessHours: { enabled: false, timezone: 'America/Sao_Paulo', schedule: [] },
        vacationMode: false,
        vacationMessage: '',
        vacationReturnsAt: '',
      },
    };
  }

  async updateStoreSettings(tenantId: number, data: any) {
    // Separa os campos top-level do storeConfig
    const { storeConfig, ...top } = data;
    const current = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const merged = { ...(current?.storeConfig || {}), ...(storeConfig || {}) };
    return (this.prisma as any).settings.upsert({
      where:  { tenantId },
      create: { tenantId, ...top, storeConfig: merged },
      update: { ...top, storeConfig: merged },
    });
  }

  async listAdminCategories(tenantId: number) {
    const cats = await (this.prisma as any).productType.findMany({
      where: { tenantId },
      orderBy: [{ storeOrder: 'asc' }, { name: 'asc' }],
    });
    const counts = await (this.prisma as any).product.groupBy({
      by: ['typeId'],
      where: { tenantId, visibleInStore: true },
      _count: { _all: true },
    });
    const countMap = new Map<number, number>();
    for (const c of counts) countMap.set(c.typeId, c._count?._all || 0);
    return cats.map((c: any) => ({
      ...c,
      visibleProductCount: countMap.get(c.id) || 0,
    }));
  }
}
