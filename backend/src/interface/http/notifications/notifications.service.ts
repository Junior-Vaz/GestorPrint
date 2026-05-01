import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { NotificationsGateway } from '../../websocket/notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * `tenantId` é obrigatório. Antes tinha fallback `?? 1` que poluía o tenant
   * da plataforma com notificações de outros tenants quando o caller esquecia
   * de passar o id — vetor real de cross-tenant data leak.
   */
  async create(data: { title: string; message: string; type?: string; tenantId: number }) {
    if (typeof data.tenantId !== 'number') {
      // Loga e falha antes de gravar lixo no tenant errado
      this.logger.error(`notifications.create chamado SEM tenantId: ${JSON.stringify(data)}`);
      throw new BadRequestException('tenantId é obrigatório em notifications.create');
    }
    const notification = await (this.prisma as any).notification.create({
      data: {
        ...data,
        tenantId: data.tenantId,
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
