import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(data: { title: string; message: string; type?: string }) {
    const notification = await (this.prisma as any).notification.create({
      data: {
        ...data,
        type: data.type || 'INFO',
      },
    });

    this.gateway.sendNotification(notification);
    return notification;
  }

  async findAll() {
    return (this.prisma as any).notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: number) {
    return (this.prisma as any).notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead() {
    return (this.prisma as any).notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
  }
}
