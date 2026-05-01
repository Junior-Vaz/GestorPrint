export type EstimateType = 'plotter' | 'cutting' | 'embroidery' | 'service';
export type EstimateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  EXPIRED: 'Expirado',
};

/**
 * Derives the product description for the converted Order from an estimate's type and details.
 * Pure business logic — no framework dependencies.
 */
export function buildProductDescription(estimateType: EstimateType, details: any): string {
  const qty = details.quantity || details.quantidade;
  const qtyStr = qty ? ` × ${qty}un` : '';

  if (estimateType === 'plotter' ||
     (estimateType === 'cutting' && details.calculationMethod !== 'per_piece')) {
    const w = details.width || details.largura;
    const h = details.height || details.altura;
    const dimStr = w && h ? ` ${w}×${h}cm` : '';
    return `${details.materialName || details.productName || 'Impresso'}${dimStr}${qtyStr}`;
  }

  if (estimateType === 'embroidery' && details.calculationMethod === 'setup_plus_per_piece') {
    return `${details.productName || 'Estamparia'}${qtyStr} (setup incluso)`;
  }

  return `${details.productName || details.produto || 'Serviço'}${qtyStr}`;
}
