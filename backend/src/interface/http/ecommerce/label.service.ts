import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { ShippingService } from './shipping.service';
import { MelhorEnviosService } from './melhor-envios.service';

/**
 * Compra de etiqueta via Melhor Envios.
 * Fluxo: cart → checkout (paga do saldo ME) → generate (gera arquivo) → print (URL do PDF)
 * Docs: https://docs.melhorenvio.com.br/reference
 */
@Injectable()
export class LabelService {
  private readonly logger = new Logger(LabelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
  ) {}

  async buyLabel(tenantId: number, orderId: number) {
    // 1. Carrega pedido + cliente + endereço de envio
    const order = await (this.prisma as any).order.findFirst({
      where: { id: orderId, tenantId, source: 'ECOMMERCE' },
      include: { customer: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    if (order.paymentStatus !== 'APPROVED') {
      throw new BadRequestException('Pagamento ainda não confirmado');
    }
    // Retirada na loja não tem etiqueta — o cliente busca pessoalmente, sem
    // transportadora envolvida. Bloqueia explícito (em vez de deixar a chamada
    // ao ME falhar com "service obrigatório") pra mensagem ficar clara pro admin.
    const isPickup =
      String(order.shippingCarrier || '').toLowerCase().includes('retirar') ||
      String(order.shippingCarrier || '').toLowerCase() === 'loja' ||
      String(order.shippingService || '').toLowerCase().startsWith('retirar');
    if (isPickup) {
      throw new BadRequestException(
        'Pedido marcado pra retirada na loja — não precisa (e não dá) gerar etiqueta. ' +
        'Avise o cliente quando estiver pronto pra retirada.'
      );
    }
    if (!order.shippingAddress) {
      throw new BadRequestException('Pedido sem endereço de envio');
    }
    if (!order.shippingService) {
      throw new BadRequestException('Serviço de frete não definido no pedido');
    }
    if (order.shippingLabelUrl) {
      throw new BadRequestException('Etiqueta já gerada para este pedido');
    }
    // ME exige CPF/CNPJ do destinatário — bloqueia cedo aqui pra evitar o
    // erro genérico 422 do gateway. A maioria dos casos é cliente antigo cujo
    // Customer foi criado sem document antes da gente exigir CPF no checkout.
    const customerDoc = String(order.customer?.document || '').replace(/\D/g, '');
    if (!customerDoc || (customerDoc.length !== 11 && customerDoc.length !== 14)) {
      throw new BadRequestException(
        'CPF/CNPJ do cliente não está cadastrado neste pedido. ' +
        'Edite o cliente em ERP → Clientes, preencha o CPF, e tente novamente. ' +
        'O Melhor Envios exige documento válido do destinatário pra emitir etiqueta.'
      );
    }

    // 2. Carrega settings (token + endereço de origem + dados da empresa)
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const token = settings?.meAccessToken;
    if (!token) {
      throw new BadRequestException('Token Melhor Envios não configurado em Configurações');
    }
    if (!settings?.originCep) {
      throw new BadRequestException('CEP de origem não configurado');
    }
    if (!settings?.companyName || !settings?.cnpj) {
      throw new BadRequestException('Nome da empresa e CNPJ obrigatórios em Configurações para gerar etiqueta');
    }

    const env = settings?.meEnvironment || 'sandbox';
    const baseUrl = env === 'production'
      ? 'https://melhorenvio.com.br'
      : 'https://sandbox.melhorenvio.com.br';

    // 3. Resolve o ID numérico do serviço (PAC/Sedex/...) re-calculando o frete
    const items = (order.details as any)?.items || [];
    const cartItems = items.map((i: any) => ({ productId: i.id, qty: i.qty }));
    const { options } = await this.shipping.calculate({
      tenantId,
      destinationCep: order.shippingAddress.cep,
      items: cartItems,
    });
    const matched = options.find(o =>
      o.name?.toLowerCase() === String(order.shippingService).toLowerCase()
      && (!order.shippingCarrier || o.company?.toLowerCase() === String(order.shippingCarrier).toLowerCase())
    );
    if (!matched || !matched.id || matched.id === 'pac' || matched.id === 'sedex') {
      throw new BadRequestException(
        'Não foi possível resolver o serviço Melhor Envios — verifique se o token tem o ambiente correto (sandbox/production)'
      );
    }

    const a = order.originAddress = settings.originAddress || {};
    const dest = order.shippingAddress;
    const origin = settings.originAddress || {};

    // ── Documento do remetente (Melhor Envios) ─────────────────────────────
    // ME exige duas coisas distintas no `from`:
    //   - `document`: SEMPRE um CPF válido (11 dígitos) do responsável legal.
    //   - `company_document`: opcional, CNPJ da empresa (14 dígitos).
    //
    // Antes mandávamos o mesmo `cnpj` em ambos os campos — ME rejeitava com
    // 422 "from.document deve ter um CPF válido" quando a loja era PJ. Agora:
    //   - Se Settings.cnpj é CPF (11) → usa direto em `document`, sem company_document.
    //   - Se Settings.cnpj é CNPJ (14) → exige `responsibleCpf` em storeConfig
    //     (CPF do dono/responsável); manda CNPJ em company_document.
    const rawDoc = (settings.cnpj || '').replace(/\D/g, '');
    const responsibleCpf = String(
      (settings.storeConfig as any)?.responsibleCpf || ''
    ).replace(/\D/g, '');

    let fromDocument: string;
    let fromCompanyDocument: string | undefined;
    if (rawDoc.length === 11) {
      // Pessoa Física — CPF direto, sem CNPJ
      fromDocument = rawDoc;
      fromCompanyDocument = undefined;
    } else if (rawDoc.length === 14) {
      // Pessoa Jurídica — exige CPF do responsável separado
      if (responsibleCpf.length !== 11) {
        throw new BadRequestException(
          'CPF do responsável legal não configurado. Vá em ERP → Ecommerce → ' +
          'Configurações → aba Envio → "CPF do responsável legal" e preencha. ' +
          'O Melhor Envios exige um CPF válido (não apenas o CNPJ) pra emitir etiqueta.'
        );
      }
      fromDocument = responsibleCpf;
      fromCompanyDocument = rawDoc;
    } else {
      throw new BadRequestException(
        'CNPJ/CPF da loja inválido nas configurações. Verifique em ERP → Configurações.'
      );
    }

    // 4. Adiciona ao carrinho ME
    const cartBody: any = {
      service: parseInt(matched.id, 10),
      from: {
        name:        settings.companyName,
        phone:       (settings.phone || '').replace(/\D/g, ''),
        email:       settings.email || settings.smtpUser || 'no-reply@gestorprint.com',
        document:    fromDocument,
        ...(fromCompanyDocument ? { company_document: fromCompanyDocument } : {}),
        address:     origin.street || '',
        complement:  origin.complement || '',
        number:      origin.number || 'S/N',
        district:    origin.neighborhood || '',
        city:        origin.city || '',
        state_abbr:  origin.state || '',
        country_id:  'BR',
        postal_code: settings.originCep.replace(/\D/g, ''),
      },
      to: {
        name:        order.customer?.name || 'Cliente',
        phone:       (order.customer?.phone || '').replace(/\D/g, ''),
        email:       order.customer?.email || '',
        document:    (order.customer?.document || '').replace(/\D/g, ''),
        address:     dest.street,
        complement:  dest.complement || '',
        number:      dest.number,
        district:    dest.neighborhood,
        city:        dest.city,
        state_abbr:  dest.state,
        country_id:  'BR',
        postal_code: String(dest.cep).replace(/\D/g, ''),
      },
      products: items.map((i: any) => ({
        name:           i.name,
        quantity:       i.qty,
        unitary_value:  Number(i.unitPrice),
      })),
      volumes: await this.buildVolumes(items),
      options: {
        insurance_value: items.reduce((s: number, i: any) => s + Number(i.unitPrice) * i.qty, 0),
        receipt:         false,
        own_hand:        false,
        reverse:         false,
        non_commercial:  true,
        platform:        'GestorPrint',
        tags: [{ tag: `pedido-${order.id}`, url: null }],
      },
    };

    const cartRes = await this.meRequest(`${baseUrl}/api/v2/me/cart`, token, cartBody);
    const meShipmentId = cartRes?.id;
    if (!meShipmentId) {
      throw new BadRequestException(`Falha ao adicionar ao carrinho ME: ${cartRes?.message || 'resposta inválida'}`);
    }

    // 5. Checkout (paga do saldo ME)
    try {
      await this.meRequest(`${baseUrl}/api/v2/me/shipment/checkout`, token, { orders: [meShipmentId] });
    } catch (e: any) {
      // Mantém o cart_id no banco mesmo se o checkout falhou — admin pode pagar manualmente no painel ME
      await (this.prisma as any).order.updateMany({
        where: { id: order.id, tenantId },
        data:  { meShipmentId, shippingStatus: 'CART_PENDING' },
      });
      // Detecta especificamente "saldo insuficiente" pra dar mensagem útil
      // com valor faltante e link de recarga (UI usa pra abrir painel ME).
      const errMsg = String(e?.message || '');
      if (/saldo.*insuficiente|insufficient.*balance/i.test(errMsg)) {
        const parsed = MelhorEnviosService.parseInsufficientBalance(errMsg);
        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const valuePart = parsed
          ? ` Saldo atual: ${fmt(parsed.current)} · Custo da etiqueta: ${fmt(parsed.required)} · Falta recarregar: ${fmt(parsed.missing)}.`
          : '';
        throw new BadRequestException(
          `Saldo insuficiente no Melhor Envios pra emitir esta etiqueta.${valuePart} ` +
          `Recarregue em https://app.melhorenvio.com.br/melhor-carteira e tente novamente. ` +
          `O pedido foi adicionado ao carrinho ME (${meShipmentId}) e fica esperando.`
        );
      }
      throw new BadRequestException(
        `Pedido adicionado ao carrinho ME (${meShipmentId}), mas falha no checkout: ${errMsg}. ` +
        `Recarregue saldo no Melhor Envios e finalize manualmente.`
      );
    }

    // 6. Generate (gera o arquivo)
    await this.meRequest(`${baseUrl}/api/v2/me/shipment/generate`, token, { orders: [meShipmentId] });

    // 7. Print (URL do PDF)
    const printRes = await this.meRequest(`${baseUrl}/api/v2/me/shipment/print`, token, {
      mode:   'private',
      orders: [meShipmentId],
    });
    const labelUrl = printRes?.url || printRes?.[meShipmentId]?.url;
    if (!labelUrl) {
      throw new BadRequestException(`Etiqueta gerada mas URL não retornada. Acesse o painel ME pra baixar (envio ${meShipmentId})`);
    }

    // 8. Salva no Order — updateMany ancora tenantId pra defesa em camadas
    await (this.prisma as any).order.updateMany({
      where: { id: order.id, tenantId },
      data: {
        meShipmentId,
        shippingLabelUrl: labelUrl,
        shippingStatus:   'LABELED',
      },
    });
    const updated = await (this.prisma as any).order.findUnique({ where: { id: order.id } });

    return { ok: true, labelUrl, meShipmentId, order: updated };
  }

  /** Wrapper das requisições ao ME com headers e tratamento de erro */
  private async meRequest(url: string, token: string, body: any) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept':         'application/json',
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${token}`,
        'User-Agent':     'GestorPrint Ecommerce (admin@gestorprint.com.br)',
      },
      body: JSON.stringify(body),
    });

    let data: any;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      const msg = data?.message || data?.error || `HTTP ${res.status}`;
      this.logger.warn(`ME ${url} → ${res.status}: ${JSON.stringify(data).substring(0, 300)}`);
      throw new Error(msg);
    }
    return data;
  }

  /** Calcula volumes (uma "caixa" agregando dimensões; soma alturas, pega max de largura/comprimento) */
  private async buildVolumes(items: any[]) {
    if (!items?.length) return [{ height: 5, width: 11, length: 16, weight: 0.1 }];

    // Carrega produtos pra ter dimensões reais
    const ids = items.map(i => i.id);
    const products = await (this.prisma as any).product.findMany({ where: { id: { in: ids } } });
    const byId = new Map(products.map((p: any) => [p.id, p]));

    let totalHeight = 0;
    let maxWidth    = 11;
    let maxLength   = 16;
    let totalWeight = 0;

    for (const it of items) {
      const p: any = byId.get(it.id);
      const h = Number(p?.heightCm  || 2);
      const w = Number(p?.widthCm   || 11);
      const l = Number(p?.lengthCm  || 16);
      const wt = Number((p?.weightGrams || 100) / 1000);
      totalHeight += h * it.qty;
      maxWidth     = Math.max(maxWidth, w);
      maxLength    = Math.max(maxLength, l);
      totalWeight += wt * it.qty;
    }

    return [{
      height: Math.max(2, totalHeight),
      width:  maxWidth,
      length: maxLength,
      weight: Math.max(0.1, totalWeight),
    }];
  }
}
