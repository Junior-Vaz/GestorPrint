import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WS_CORS } from '../../shared/websocket-cors';
import { authenticateSocket, tenantRoom } from '../../shared/ws-auth.helper';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

@WebSocketGateway({ cors: WS_CORS })
export class OrdersGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('OrdersGateway');

  constructor(private readonly prisma: PrismaService) {}

  afterInit(_server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  /**
   * Autentica o cliente via JWT no handshake. Bloqueia tenants suspensos.
   * Joina o socket numa sala dedicada `tenant:{id}` pra notifyXxx() emitir
   * só pros sockets daquele tenant — evita vazamento cross-tenant.
   */
  async handleConnection(client: Socket) {
    try {
      const user = authenticateSocket(client);

      // Super admins podem ouvir qualquer tenant — mas o default é só o próprio
      if (!user.isSuperAdmin && user.tenantId) {
        const tenant = await (this.prisma as any).tenant.findUnique({
          where: { id: user.tenantId },
          select: { planStatus: true },
        });
        if (tenant && ['SUSPENDED', 'CANCELLED'].includes(tenant.planStatus)) {
          this.logger.warn(`WS connection rejected — tenant ${user.tenantId} ${tenant.planStatus}`);
          client.emit('auth_error', { reason: 'TENANT_SUSPENDED' });
          client.disconnect(true);
          return;
        }
      }

      (client.data as any).user = user;
      if (user.tenantId) client.join(tenantRoom(user.tenantId));
      this.logger.log(`Client connected: ${client.id} tenant=${user.tenantId} user=${user.id}`);
    } catch (e: any) {
      this.logger.warn(`WS auth failed: ${e?.message || e}`);
      client.emit('auth_error', { reason: e?.message || 'AUTH_FAILED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Emite só pros sockets do tenant dono do pedido. */
  notifyNewOrder(order: any) {
    if (!order?.tenantId) return;
    this.server.to(tenantRoom(order.tenantId)).emit('new_order', order);
  }

  notifyOrderUpdated(order: any) {
    if (!order?.tenantId) return;
    this.server.to(tenantRoom(order.tenantId)).emit('order_updated', order);
  }
}
