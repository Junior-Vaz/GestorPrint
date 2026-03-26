import axios from 'axios';
import { FlowNode, FlowEdge, FlowSession, AiConfig, ActionNodeData, HandlerResult } from '../types/flow.js';

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'gestorprint-internal-2026';
const internalHeaders = { 'x-internal-key': INTERNAL_KEY };

export async function handleAction(
  node: FlowNode,
  edges: FlowEdge[],
  session: FlowSession,
  cfg: AiConfig,
  erpUrl: string,
): Promise<HandlerResult> {
  const data = node.data as ActionNodeData;
  const tenantId = cfg.tenantId;
  const nextEdge = edges[0];
  let confirmMessage = data.confirmMessage || 'Ação concluída com sucesso!';

  try {
    switch (data.action) {
      case 'create_estimate': {
        const res = await axios.post(
          `${erpUrl}/mcp/flow-estimate`,
          { tenantId, collectedData: session.collectedData },
          { headers: internalHeaders },
        );
        const estimate = res.data as any;
        console.log('[ACTION] estimate created:', estimate?.id, 'customer:', estimate?.customer?.name, 'total:', estimate?.totalPrice);
        const idStr = estimate?.id ? ` #${estimate.id}` : '';
        const totalFmt = Number(estimate?.totalPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const cd = session.collectedData;
        confirmMessage = (data.confirmMessage || 'Orçamento{id} criado! Em breve nossa equipe entrará em contato. 😊')
          .replace('{id}', idStr)
          .replace('{estimateId}', String(estimate?.id || ''))
          .replace('{total}', totalFmt)
          .replace('{produto}', String(cd.produto || cd.productName || ''))
          .replace('{quantidade}', String(cd.quantidade || cd.quantity || ''))
          .replace('{largura}', String(cd.largura || cd.width || ''))
          .replace('{altura}', String(cd.altura || cd.height || ''));
        break;
      }

      case 'generate_pix': {
        const orderId = session.collectedData.orderId;
        if (!orderId) {
          return { responseText: 'Nenhum pedido encontrado para gerar o PIX.', nextNodeId: null };
        }
        const res = await axios.post(`${erpUrl}/mcp/rpc`, {
          method: 'tools/call',
          params: { name: 'generate_pix', arguments: { orderId: Number(orderId) } },
          tenantId,
        });
        const parts = (res.data as any)?.content || [];
        const pixText = parts.map((p: any) => p.text).join('\n');
        confirmMessage = data.confirmMessage || pixText;
        break;
      }

      case 'calculate_and_pix': {
        const productRef = data.productRef || session.collectedData.product || '';
        const quantityField = data.quantityField || 'quantity';
        const quantity = Number(session.collectedData[quantityField] || 1);
        const customerId = session.collectedData.customerId;

        if (!productRef) {
          return { responseText: 'Produto não definido para calcular o valor.', nextNodeId: null };
        }

        const res = await axios.post(`${erpUrl}/mcp/flow-pix`, {
          tenantId,
          productRef,
          quantity,
          customerId: customerId ? Number(customerId) : undefined,
        }, { headers: internalHeaders });

        const { orderId, total, unitPrice, product, pix } = res.data as any;

        const totalFmt = Number(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const unitFmt = Number(unitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let msg = data.confirmMessage || '✅ Pedido criado!\n\n📦 {product}\n📐 Quantidade: {quantity}\n💰 {unitPrice} × {quantity} = *{total}*\n\n🔑 Pix Copia e Cola:\n{pixCode}';
        msg = msg
          .replace('{product}', product)
          .replace(/{quantity}/g, String(quantity))
          .replace('{unitPrice}', unitFmt)
          .replace('{total}', totalFmt)
          .replace('{pixCode}', pix?.qrCode || '')
          .replace('{pixUrl}', pix?.paymentUrl || '')
          .replace('{orderId}', String(orderId));

        return {
          responseText: msg,
          nextNodeId: nextEdge?.target ?? null,
          updatedData: { orderId, total, pixCode: pix?.qrCode },
        };
      }

      case 'notify_operator': {
        // Log notification — in the future could trigger webhook/socket
        console.log(`[ACTION] Notify operator — tenant=${tenantId} data=`, session.collectedData);
        confirmMessage = data.confirmMessage || 'Nossa equipe foi notificada e entrará em contato em breve.';
        break;
      }

      default:
        return { responseText: 'Ação desconhecida.', nextNodeId: null };
    }
  } catch (e: any) {
    const detail = e.response?.data ? JSON.stringify(e.response.data).substring(0, 300) : e.message;
    console.error('[ACTION] Error:', detail);
    return { responseText: `Ocorreu um erro ao processar sua solicitação: ${detail}`, nextNodeId: null };
  }

  return {
    responseText: confirmMessage,
    nextNodeId: nextEdge?.target ?? null,
  };
}
