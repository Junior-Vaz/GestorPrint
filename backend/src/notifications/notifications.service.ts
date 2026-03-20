import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(data: { title: string; message: string; type?: string; tenantId?: number }) {
    const notification = await (this.prisma as any).notification.create({
      data: {
        ...data,
        tenantId: data.tenantId ?? 1,
        type: data.type || 'INFO',
      },
    });

    this.gateway.sendNotification(notification);
    return notification;
  }

  async findAll(tenantId: number) {
    return (this.prisma as any).notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: number, tenantId: number) {
    return (this.prisma as any).notification.updateMany({
      where: { id, tenantId },
      data: { read: true },
    });
  }

  async markAllAsRead(tenantId: number) {
    return (this.prisma as any).notification.updateMany({
      where: { read: false, tenantId },
      data: { read: true },
    });
  }
}
