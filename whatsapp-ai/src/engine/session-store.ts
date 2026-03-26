import { FlowSession } from '../types/flow.js';

const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  session: FlowSession;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function key(tenantId: number, phone: string): string {
  return `${tenantId}:${phone}`;
}

export function getCachedSession(tenantId: number, phone: string): FlowSession | null {
  const entry = cache.get(key(tenantId, phone));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key(tenantId, phone));
    return null;
  }
  return entry.session;
}

export function setCachedSession(tenantId: number, phone: string, session: FlowSession): void {
  cache.set(key(tenantId, phone), {
    session,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function deleteCachedSession(tenantId: number, phone: string): void {
  cache.delete(key(tenantId, phone));
}
