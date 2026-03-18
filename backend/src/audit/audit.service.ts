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
  ) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          details: details ? JSON.parse(JSON.stringify(details)) : null,
        },
      });
    } catch (e) {
      console.error('Failed to log audit action:', e);
    }
  }

  async findAll(query?: any) {
    const where: any = {};
    if (query?.entity) where.entity = query.entity;
    if (query?.action) where.action = query.action;
    if (query?.userId) where.userId = parseInt(query.userId);

    return this.prisma.auditLog.findMany({
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
      take: 200, // Limit for performance
    });
  }

  async findOne(id: number) {
    return this.prisma.auditLog.findUnique({
      where: { id },
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
