import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WS_CORS } from '../../shared/websocket-cors';
import { authenticateSocket, tenantRoom } from '../../shared/ws-auth.helper';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

@WebSocketGateway({ cors: WS_CORS })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger('NotificationsGateway');

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    try {
      const user = authenticateSocket(client);
      if (!user.isSuperAdmin && user.tenantId) {
        const tenant = await (this.prisma as any).tenant.findUnique({
          where: { id: user.tenantId },
          select: { planStatus: true },
        });
        if (tenant && ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
          client.emit('auth_error', { reason: 'TENANT_SUSPENDED' });
          client.disconnect(true);
          return;
        }
      }
      (client.data as any).user = user;
      if (user.tenantId) client.join(tenantRoom(user.tenantId));
    } catch (e: any) {
      this.logger.warn(`WS auth failed: ${e?.message || e}`);
      client.emit('auth_error', { reason: e?.message || 'AUTH_FAILED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {}

  /** Emite só pros sockets do tenant dono da notificação. */
  sendNotification(notification: any) {
    if (!this.server) return;
    if (!notification?.tenantId) return;
    this.server.to(tenantRoom(notification.tenantId)).emit('notification_received', notification);
  }
}
