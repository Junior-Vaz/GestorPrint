import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { resolveJwtSecret } from './jwt-secret';

// Lazy: resolve só quando alguém conecta — assim NestFactory.create() já rodou
// e o resolveJwtSecret pode falhar com erro claro em produção sem env.
let _secret: string | null = null;
function getSecret(): string {
  if (_secret === null) _secret = resolveJwtSecret();
  return _secret;
}

export interface WsUser {
  id:           number;
  email:        string;
  role:         string;
  tenantId:     number;
  isSuperAdmin: boolean;
}

/**
 * Extrai o JWT do handshake (auth.token | query.token | header Authorization).
 * Valida assinatura e retorna o user. Lança em caso de inválido/expirado.
 */
export function authenticateSocket(client: Socket): WsUser {
  const token =
    (client.handshake?.auth as any)?.token ||
    (client.handshake?.query as any)?.token ||
    extractBearer((client.handshake?.headers as any)?.authorization);

  if (!token || typeof token !== 'string') {
    throw new Error('NO_TOKEN');
  }

  let payload: any;
  try {
    payload = jwt.verify(token, getSecret());
  } catch (e: any) {
    throw new Error(e?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
  }

  return {
    id:           payload.sub,
    email:        payload.email,
    role:         payload.role,
    tenantId:     payload.tenantId,
    isSuperAdmin: payload.isSuperAdmin ?? false,
  };
}

function extractBearer(h?: string): string | null {
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

/** Sala canônica por tenant — todos os emits devem ir pra `tenant:${tenantId}`. */
export function tenantRoom(tenantId: number): string {
  return `tenant:${tenantId}`;
}
