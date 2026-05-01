import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { EcommerceService } from './ecommerce.service';

/**
 * Endpoints SEO públicos:
 *  - GET /sitemap.xml  → Lista todas URLs públicas (Home, Catálogo, produtos, blog, etc)
 *  - GET /robots.txt   → Permite tudo + aponta o sitemap
 *
 * Ambos NÃO usam tenantId na URL — o middleware/host extrai do hostname (em
 * produção). Em dev, fallback pra tenantId=1 ou query string.
 */
@Public()
@Controller()
export class SeoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecommerce: EcommerceService,
  ) {}

  /**
   * Resolve o tenantId pelo hostname (produção) ou query (?tenantId=1, dev).
   * Igual à lógica de bootstrap da SPA — mantém consistência.
   */
  private async resolveTenantId(req: any, fallback?: string): Promise<number> {
    if (fallback) return parseInt(fallback, 10) || 1;
    const host = (req.headers['host'] || '').split(':')[0];
    if (host) {
      try {
        const t = await this.ecommerce.resolveTenantByDomain(host);
        if (t?.tenantId) return t.tenantId;
      } catch { /* fallback abaixo */ }
    }
    return 1;
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')   // 1h cache em CDN/proxy
  async sitemap(@Req() req: any, @Query('tenantId') tenantIdQ?: string): Promise<string> {
    const tenantId = await this.resolveTenantId(req, tenantIdQ);
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host  = (req.headers['host'] as string) || 'localhost';
    const base  = `${proto}://${host}`;

    // Páginas estáticas — sempre presentes
    const staticPaths = [
      { loc: '/',                   changefreq: 'daily',   priority: '1.0' },
      { loc: '/catalogo',           changefreq: 'daily',   priority: '0.9' },
      { loc: '/sobre',              changefreq: 'monthly', priority: '0.6' },
      { loc: '/blog',               changefreq: 'weekly',  priority: '0.7' },
      { loc: '/faq',                changefreq: 'monthly', priority: '0.5' },
      { loc: '/contato',            changefreq: 'monthly', priority: '0.5' },
      // Páginas legais — Google indexa estas pra cumprir requisito E-E-A-T (transparência).
      { loc: '/politica-de-trocas', changefreq: 'yearly',  priority: '0.3' },
      { loc: '/privacidade',        changefreq: 'yearly',  priority: '0.3' },
      { loc: '/termos',             changefreq: 'yearly',  priority: '0.3' },
    ];

    // Produtos visíveis com slug
    const products = await (this.prisma as any).product.findMany({
      where: { tenantId, visibleInStore: true, slug: { not: null }, productType: { visibleInStore: true } },
      select: { slug: true, updatedAt: true },
    });

    // Posts do blog publicados
    const posts = await (this.prisma as any).blogPost.findMany({
      where: { tenantId, published: true, slug: { not: null } },
      select: { slug: true, updatedAt: true },
    }).catch(() => []);

    const urls: string[] = [];
    for (const p of staticPaths) {
      urls.push(`<url><loc>${base}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`);
    }
    for (const p of products) {
      const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString() : '';
      urls.push(`<url><loc>${base}/produto/${p.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    }
    for (const p of posts) {
      const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString() : '';
      urls.push(`<url><loc>${base}/blog/${p.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.6</priority></url>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  robots(@Req() req: any): string {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host  = (req.headers['host'] as string) || 'localhost';
    return [
      'User-agent: *',
      'Allow: /',
      // Bloqueia rotas que não fazem sentido pro Google
      'Disallow: /checkout',
      'Disallow: /cliente',
      'Disallow: /login',
      'Disallow: /pedido/',
      'Disallow: /verificar-email',
      'Disallow: /redefinir-senha',
      'Disallow: /recuperar-senha',
      '',
      `Sitemap: ${proto}://${host}/sitemap.xml`,
    ].join('\n');
  }
}
