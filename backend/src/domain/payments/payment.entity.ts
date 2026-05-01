export type TransactionStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentType = 'PIX' | 'LINK' | 'CASH' | 'CARD';

export interface PaymentTransaction {
  id: number;
  orderId: number;
  amount: number;
  status: TransactionStatus;
  paymentType: PaymentType;
  gatewayId?: string | null;
  paymentUrl?: string | null;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
}

export interface OrderForPayment {
  id: number;
  tenantId: number;
  amount: number;
  customer: {
    name: string;
    email: string | null;
    document: string | null;
  };
}

/**
 * Extracts a valid Brazilian CPF (11 digits) or CNPJ (14 digits) from a raw string.
 * Returns null if the cleaned value is not exactly 11 or 14 digits.
 */
export function extractValidDocument(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14 ? digits : null;
}
