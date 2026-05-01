import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WS_CORS } from '../../shared/websocket-cors';
import { authenticateSocket } from '../../shared/ws-auth.helper';

/**
 * Namespace dedicado pra logs do sistema. Sem namespace, qualquer cliente
 * conectando no socket.io default ('/') passaria por esse handleConnection
 * e seria desconectado pela checagem de super admin — derrubando junto a
 * conexão dos outros gateways (Orders/Notifications) que compartilham
 * o mesmo socket subjacente.
 *
 * Cliente conecta com `io('/logs', { auth: { token } })`.
 */
@WebSocketGateway({ cors: WS_CORS, namespace: '/logs' })
export class LogsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private logger = new Logger('LogsGateway');

  /**
   * Logs de sistema vazam stack traces e segredos. Restrito a super admin.
   * Operadores normais (mesmo ADMIN do tenant) NÃO podem subscrever.
   */
  handleConnection(client: Socket) {
    try {
      const user = authenticateSocket(client);
      if (!user.isSuperAdmin) {
        client.emit('auth_error', { reason: 'SUPER_ADMIN_ONLY' });
        client.disconnect(true);
        return;
      }
      (client.data as any).user = user;
      // Sem join: já estamos no namespace dedicado /logs, todos os sockets ouvem.
    } catch (e: any) {
      this.logger.warn(`WS auth failed: ${e?.message || e}`);
      client.emit('auth_error', { reason: e?.message || 'AUTH_FAILED' });
      client.disconnect(true);
    }
  }

  emit(entry: { level: string; context: string; message: string; timestamp: string }) {
    if (this.server) {
      // Já estamos no namespace /logs — emite pra todos os sockets dele.
      this.server.emit('system_log', entry);
    }
  }
}
