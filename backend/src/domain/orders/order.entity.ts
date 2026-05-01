export type OrderStatus =
  | 'PENDING'
  | 'PRODUCTION'
  | 'FINISHED'
  | 'COMPLETED'
  | 'DELIVERED'
  | 'CANCELLED';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  PRODUCTION: 'Em Produção',
  FINISHED: 'Finalizado / Pronto',
  COMPLETED: 'Concluído',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

/**
 * Returns true when transitioning to PRODUCTION requires stock deduction.
 */
export function shouldDeductStock(prev: OrderStatus, next: OrderStatus): boolean {
  return prev !== 'PRODUCTION' && next === 'PRODUCTION';
}

/**
 * Returns true when the status change should trigger a messaging notification.
 */
export function shouldNotifyStatus(prev: OrderStatus, next: OrderStatus): boolean {
  const notifiable: OrderStatus[] = ['PRODUCTION', 'COMPLETED', 'DELIVERED', 'CANCELLED'];
  return prev !== next && notifiable.includes(next);
}

/**
 * Validates that a status transition is allowed.
 * Returns an error message or null if valid.
 */
export function validateStatusTransition(from: OrderStatus, to: OrderStatus): string | null {
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    PENDING:    ['PRODUCTION', 'CANCELLED'],
    PRODUCTION: ['FINISHED', 'CANCELLED'],
    FINISHED:   ['COMPLETED', 'DELIVERED', 'CANCELLED'],
    COMPLETED:  ['DELIVERED'],
    DELIVERED:  [],
    CANCELLED:  [],
  };
  if (!allowed[from].includes(to)) {
    return `Transição inválida: ${from} → ${to}`;
  }
  return null;
}
