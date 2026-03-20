import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logAction(
    userId: number,
    action: string,
    entity: string,
    entityId?: number,
    details?: any,
    tenantId = 1,
  ) {
    try {
      return await (this.prisma.auditLog as any).create({
        data: {
          userId,
          action,
          entity,
          entityId,
          tenantId,
          details: details ? JSON.parse(JSON.stringify(details)) : null,
        },
      });
    } catch (e) {
      console.error('Failed to log audit action:', e);
    }
  }

  async findAll(tenantId: number, query?: any) {
    const where: any = { tenantId };
    if (query?.entity) where.entity = query.entity;
    if (query?.action) where.action = query.action;
    if (query?.userId) where.userId = parseInt(query.userId);

    return (this.prisma.auditLog as any).findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: number, tenantId: number) {
    return (this.prisma.auditLog as any).findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
}
