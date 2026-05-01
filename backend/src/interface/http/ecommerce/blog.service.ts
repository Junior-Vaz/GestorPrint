import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { EcommerceService } from './ecommerce.service';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Públicos ────────────────────────────────────────────────────────────────
  async listPublic(tenantId: number, filters: { category?: string; tag?: string } = {}) {
    const where: any = { tenantId, status: 'PUBLISHED' };
    if (filters.category) where.category = filters.category;
    if (filters.tag)      where.tags = { has: filters.tag };
    return (this.prisma as any).blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true, title: true, slug: true, coverImage: true,
        excerpt: true, category: true, tags: true, author: true,
        publishedAt: true,
      },
    });
  }

  async getPublic(tenantId: number, slug: string) {
    const post = await (this.prisma as any).blogPost.findFirst({
      where: { tenantId, slug, status: 'PUBLISHED' },
    });
    if (!post) throw new NotFoundException('Post não encontrado');
    return post;
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
  /**
   * Lista posts com paginação. Limites defensivos:
   *   - page mínimo 1
   *   - pageSize entre 10 e 100 (admin geralmente não precisa de mais que isso)
   */
  async listAdmin(tenantId: number, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeSize = Math.min(100, Math.max(10, Math.floor(pageSize) || 20));
    const skip = (safePage - 1) * safeSize;
    const where = { tenantId };
    const [data, total] = await Promise.all([
      (this.prisma as any).blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeSize,
      }),
      (this.prisma as any).blogPost.count({ where }),
    ]);
    return { data, total, page: safePage, pageSize: safeSize };
  }

  async getAdmin(tenantId: number, id: number) {
    const post = await (this.prisma as any).blogPost.findFirst({
      where: { id, tenantId },
    });
    if (!post) throw new NotFoundException('Post não encontrado');
    return post;
  }

  async create(tenantId: number, data: any) {
    if (!data.title) throw new BadRequestException('Título obrigatório');
    if (!data.content) throw new BadRequestException('Conteúdo obrigatório');

    const slug = data.slug
      ? EcommerceService.slugify(data.slug)
      : await this.uniqueSlug(EcommerceService.slugify(data.title));

    return (this.prisma as any).blogPost.create({
      data: {
        tenantId,
        title:           data.title,
        slug,
        coverImage:      data.coverImage || null,
        excerpt:         data.excerpt || null,
        content:         data.content,
        category:        data.category || null,
        tags:            Array.isArray(data.tags) ? data.tags : [],
        author:          data.author || null,
        status:          data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        publishedAt:     data.status === 'PUBLISHED' ? new Date() : null,
        metaTitle:       data.metaTitle || null,
        metaDescription: data.metaDescription || null,
      },
    });
  }

  async update(tenantId: number, id: number, data: any) {
    const post = await this.getAdmin(tenantId, id);
    let slug = post.slug;
    if (data.slug && data.slug !== post.slug) {
      slug = await this.uniqueSlug(EcommerceService.slugify(data.slug), id);
    }
    const willPublish = data.status === 'PUBLISHED' && post.status !== 'PUBLISHED';
    return (this.prisma as any).blogPost.update({
      where: { id },
      data: {
        title:           data.title           ?? post.title,
        slug,
        coverImage:      data.coverImage      ?? post.coverImage,
        excerpt:         data.excerpt         ?? post.excerpt,
        content:         data.content         ?? post.content,
        category:        data.category        ?? post.category,
        tags:            Array.isArray(data.tags) ? data.tags : post.tags,
        author:          data.author          ?? post.author,
        status:          data.status          ?? post.status,
        publishedAt:     willPublish ? new Date() : (data.status === 'DRAFT' ? null : post.publishedAt),
        metaTitle:       data.metaTitle       ?? post.metaTitle,
        metaDescription: data.metaDescription ?? post.metaDescription,
      },
    });
  }

  async delete(tenantId: number, id: number) {
    await this.getAdmin(tenantId, id);
    await (this.prisma as any).blogPost.delete({ where: { id } });
    return { ok: true };
  }

  private async uniqueSlug(base: string, excludeId?: number): Promise<string> {
    if (!base) return `post-${Date.now()}`;
    let slug = base;
    let i = 1;
    while (true) {
      const existing = await (this.prisma as any).blogPost.findFirst({
        where: { slug, NOT: excludeId ? { id: excludeId } : undefined },
        select: { id: true },
      });
      if (!existing) return slug;
      i++;
      slug = `${base}-${i}`;
      if (i > 50) return `${base}-${Date.now()}`;
    }
  }
}
