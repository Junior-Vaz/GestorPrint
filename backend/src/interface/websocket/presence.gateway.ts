import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WS_CORS } from '../../shared/websocket-cors';
import { authenticateSocket, tenantRoom, WsUser } from '../../shared/ws-auth.helper';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

/**
 * Presença em tempo real — mantém quem está online por tenant e dispara
 * `presence:update` a cada conexão/desconexão. UI mostra stack de avatares
 * no header do ERP.
 *
 * Modelo de tracking:
 *   tenantId → Map<userId, { name, role, photoUrl, sockets: Set<socketId> }>
 *
 * Multi-aba: o mesmo userId pode ter N sockets simultâneos (abas/devices).
 * Só removemos o user da lista online quando o último socket dele desconecta.
 * Isso evita que o avatar pisque na UI dos colegas quando o usuário troca
 * de aba ou recarrega.
 */
interface OnlineUser {
  userId:   number;
  name:     string;
  email:    string;
  role:     string;
  photoUrl: string | null;
  sockets:  Set<string>;
  since:    number;   // timestamp do primeiro socket
}

@WebSocketGateway({ cors: WS_CORS })
export class PresenceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('PresenceGateway');

  // tenantId → userId → OnlineUser
  private readonly online = new Map<number, Map<number, OnlineUser>>();

  constructor(private readonly prisma: PrismaService) {}

  afterInit(_server: Server) {
    this.logger.log('Presence gateway initialized');
  }

  async handleConnection(client: Socket) {
    let user: WsUser;
    try {
      user = authenticateSocket(client);
    } catch (e: any) {
      // Auth failed — gateway de presença é silencioso (outros gateways
      // já fazem o disconnect com mensagem clara).
      client.emit('auth_error', { reason: e?.message || 'AUTH_FAILED' });
      client.disconnect(true);
      return;
    }

    if (!user.tenantId) return;

    // Carrega dados completos do usuário pra hidratar o avatar/nome no
    // payload — evita o frontend ter que fazer fetch extra.
    let dbUser: any = null;
    try {
      dbUser = await (this.prisma as any).user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, role: true, photoUrl: true },
      });
    } catch { /* silencioso — usa fallback do JWT */ }

    (client.data as any).user = user;
    client.join(tenantRoom(user.tenantId));
    client.join(`presence:${user.tenantId}`);

    let tenantMap = this.online.get(user.tenantId);
    if (!tenantMap) {
      tenantMap = new Map();
      this.online.set(user.tenantId, tenantMap);
    }
    let entry = tenantMap.get(user.id);
    if (!entry) {
      entry = {
        userId:   user.id,
        name:     dbUser?.name  || user.email,
        email:    dbUser?.email || user.email,
        role:     dbUser?.role  || user.role,
        photoUrl: dbUser?.photoUrl || null,
        sockets:  new Set(),
        since:    Date.now(),
      };
      tenantMap.set(user.id, entry);
    }
    entry.sockets.add(client.id);

    this.broadcastPresence(user.tenantId);

    // Envia o estado atual só pra esse socket assim que conecta
    // (caso o broadcast acima chegue antes de o cliente registrar listener).
    client.emit('presence:state', this.serialize(user.tenantId));
  }

  handleDisconnect(client: Socket) {
    const user = (client.data as any)?.user as WsUser | undefined;
    if (!user?.tenantId) return;

    const tenantMap = this.online.get(user.tenantId);
    if (!tenantMap) return;
    const entry = tenantMap.get(user.id);
    if (!entry) return;

    entry.sockets.delete(client.id);
    if (entry.sockets.size === 0) {
      tenantMap.delete(user.id);
      if (tenantMap.size === 0) this.online.delete(user.tenantId);
    }
    this.broadcastPresence(user.tenantId);
  }

  /** Emite a lista atualizada pra todos os sockets do tenant. */
  private broadcastPresence(tenantId: number) {
    this.server.to(`presence:${tenantId}`).emit('presence:update', this.serialize(tenantId));
  }

  /** Serializa o Map pra array — sockets internos não vão pro client. */
  private serialize(tenantId: number) {
    const tenantMap = this.online.get(tenantId);
    if (!tenantMap) return { count: 0, users: [] };
    const users = Array.from(tenantMap.values())
      .sort((a, b) => a.since - b.since)
      .map(u => ({
        userId:   u.userId,
        name:     u.name,
        email:    u.email,
        role:     u.role,
        photoUrl: u.photoUrl,
        since:    u.since,
      }));
    return { count: users.length, users };
  }
}
