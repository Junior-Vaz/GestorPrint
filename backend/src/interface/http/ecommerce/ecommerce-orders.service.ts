import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { MercadoPagoGateway } from '../../../infrastructure/payments/mercadopago.gateway';
import { CheckFeatureUseCase } from '../../../application/entitlement/check-feature.usecase';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { EcommerceMailerService } from './ecommerce-mailer.service';
import { CouponsService } from './coupons.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { AuditService } from '../audit/audit.service';

export interface CreateEcommerceOrderInput {
  tenantId: number;
  items: { productId: number; qty: number }[];
  customer: {
    name: string;
    email: string;
    phone?: string;
    document?: string;       // CPF ou CNPJ (apenas dígitos)
    documentType?: 'CPF' | 'CNPJ';
  };
  shippingAddress: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  shippingService?: string;  // PAC | SEDEX | …
  shippingCarrier?: string;
  shippingCost?: number;
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  // Cartão (se paymentMethod === 'CREDIT_CARD'):
  cardToken?: string;
  cardPaymentMethodId?: string;   // visa / master / etc
  installments?: number;
  issuerId?: string;
  // Cupom de desconto (opcional)
  couponCode?: string;
  // Cliente logado da loja (opcional). Quando presente, indica que NÃO é
  // guest checkout — usado pra validar a regra "Permitir compra sem cadastro".
  storeCustomerId?: number;
  // Programa de fidelidade — pontos/cashback que o cliente quer aplicar como
  // desconto. Backend valida saldo (não confia no preview do frontend).
  redeemPoints?: number;
  redeemCashback?: number;
}

@Injectable()
export class EcommerceOrdersService {
  private readonly logger = new Logger(EcommerceOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoGateway,
    private readonly mailer: EcommerceMailerService,
    private readonly coupons: CouponsService,
    private readonly checkFeature: CheckFeatureUseCase,
    private readonly loyalty: LoyaltyService,
    private readonly audit: AuditService,
  ) {}

  async createOrder(input: CreateEcommerceOrderInput) {
    const { tenantId } = input;

    if (!input.items?.length) throw new BadRequestException('Carrinho vazio');
    if (!input.customer?.email) throw new BadRequestException('Email obrigatório');

    // 1. Busca settings pra saber regras (block out of stock, payment methods aceitos, etc.)
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const storeConfig = settings?.storeConfig || {};
    const blockOutOfStock    = storeConfig.blockOutOfStock !== false;
    const allowedMethods     = storeConfig.paymentMethods || { pix: true, card: true, boleto: true };
    const allowGuestCheckout = storeConfig.allowGuestCheckout !== false;

    // Modo férias — loja pausada, não aceita novos pedidos
    if (storeConfig.vacationMode === true) {
      const msg = storeConfig.vacationMessage
        ? `${storeConfig.vacationMessage}`
        : 'Estamos temporariamente fora de operação. Volte em breve!';
      throw new BadRequestException(msg);
    }

    // Regra "Permitir compra sem cadastro" — quando OFF, exige storeCustomerId
    // (cliente da loja logado). O controller injeta esse ID a partir do JWT
    // do customer-auth se o header Authorization veio com token válido.
    if (!allowGuestCheckout && !input.storeCustomerId) {
      throw new BadRequestException(
        'Esta loja exige cadastro pra finalizar a compra. Faça login ou crie sua conta.',
      );
    }

    const methodKey = input.paymentMethod === 'PIX' ? 'pix'
                    : input.paymentMethod === 'CREDIT_CARD' ? 'card'
                    : 'boleto';
    if (!allowedMethods[methodKey]) {
      throw new BadRequestException(`Método de pagamento desativado: ${input.paymentMethod}`);
    }

    // Verifica antes de tentar pagar — erro mais útil que "Falha no pagamento"
    if (!settings?.mpAccessToken) {
      throw new BadRequestException(
        'Mercado Pago não configurado. Acesse o ERP → Ecommerce → Configurações e cole o Access Token.'
      );
    }

    // 2. Carrega produtos e valida visibilidade + estoque
    const productIds = input.items.map(i => i.productId);
    const products = await (this.prisma as any).product.findMany({
      where: { id: { in: productIds }, tenantId },
    });
    const byId = new Map(products.map((p: any) => [p.id, p]));

    let subtotal = 0;
    // Soma dos descontos PIX por linha (cada produto tem seu próprio %).
    // Calculado aqui no mesmo loop pra evitar segundo lookup; usado adiante
    // se o cliente escolher PIX como método.
    let pixDiscountTotal = 0;
    const lineItems: any[] = [];
    for (const item of input.items) {
      const p: any = byId.get(item.productId);
      if (!p) throw new BadRequestException(`Produto ${item.productId} não encontrado`);
      if (!p.visibleInStore) throw new BadRequestException(`Produto fora do catálogo: ${p.name}`);
      if (blockOutOfStock && Number(p.stock) < item.qty) {
        throw new BadRequestException(`Estoque insuficiente para ${p.name} (${p.stock} disponíveis)`);
      }
      // Preço efetivo na loja: storePrice se definido, senão unitPrice (preço interno padrão)
      const effectivePrice = (p.storePrice != null && Number(p.storePrice) > 0) ? Number(p.storePrice) : Number(p.unitPrice);
      const lineTotal = effectivePrice * item.qty;
      subtotal += lineTotal;
      const pixPct = Math.max(0, Math.min(100, Number(p.pixDiscountPercent ?? 0)));
      pixDiscountTotal += lineTotal * (pixPct / 100);
      lineItems.push({
        id: p.id, name: p.name, unitPrice: effectivePrice, qty: item.qty, lineTotal,
        pixDiscountPercent: pixPct,
      });
    }
    pixDiscountTotal = +pixDiscountTotal.toFixed(2);

    const shippingCost = Number(input.shippingCost || 0);

    // Aplica cupom se fornecido. Se inválido, lança BadRequest com mensagem amigável.
    let couponDiscount = 0;
    let appliedCoupon: any = null;
    if (input.couponCode) {
      // customerId só é conhecido após encontrar/criar; pra simplicidade, valida sem ele aqui
      // (firstOrderOnly e maxUsesPerCustomer são checados depois pra clientes logados)
      appliedCoupon = await this.coupons.validate(tenantId, input.couponCode, subtotal, shippingCost);
      couponDiscount = appliedCoupon.discountAmount;
    }

    // Desconto PIX server-side — soma dos descontos por item (cada produto tem
    // seu próprio %). SEMPRE recalculado aqui (não confia em valor enviado pelo
    // cliente — segurança). Aplicado apenas quando paymentMethod === 'PIX'.
    const pixDiscount = input.paymentMethod === 'PIX' ? pixDiscountTotal : 0;

    // Programa de fidelidade — desconto via pontos/cashback. Server-side via
    // previewRedeem que valida saldo do customer logado. Guest checkout (sem
    // storeCustomerId) NÃO ganha resgate (precisa ser cliente identificado).
    let loyaltyDiscount = 0;
    let redeemPointsApplied = 0;
    let redeemCashbackApplied = 0;
    const wantsRedeem = (input.redeemPoints && input.redeemPoints > 0) || (input.redeemCashback && input.redeemCashback > 0);
    if (wantsRedeem && input.storeCustomerId) {
      try {
        const baseAmount = subtotal + shippingCost - couponDiscount - pixDiscount;
        const preview = await this.loyalty.previewRedeem(tenantId, {
          customerId: input.storeCustomerId,
          orderAmount: Math.max(0, baseAmount),
          points: input.redeemPoints,
          cashback: input.redeemCashback,
        });
        loyaltyDiscount = preview.discount;
        redeemPointsApplied = preview.points;
        redeemCashbackApplied = preview.cashback;
      } catch (err: any) {
        // Saldo insuficiente / config off / cliente não existe — segue sem
        // resgate em vez de bloquear o checkout (UX > rigor; no pior caso o
        // cliente paga o valor cheio).
        this.logger.warn(`Loyalty preview falhou: ${err.message}`);
      }
    }

    const total = +Math.max(0, subtotal + shippingCost - couponDiscount - pixDiscount - loyaltyDiscount).toFixed(2);

    // 3. Encontra/cria Customer
    //
    // Quando o customer já existe (mesmo email) mas NÃO tem document/phone
    // salvo (ex: criado em compra anterior antes da gente exigir CPF, ou
    // criado por outra rota), atualiza com os dados do input. Sem isso, o
    // Melhor Envios rejeita a etiqueta com "CNPJ ou CPF do destinatário é
    // obrigatório" — porque mandamos `to.document = order.customer?.document`
    // e o campo tá vazio.
    let customer = await (this.prisma as any).customer.findFirst({
      where: { tenantId, email: input.customer.email },
    });
    if (!customer) {
      customer = await (this.prisma as any).customer.create({
        data: {
          tenantId,
          name:     input.customer.name,
          email:    input.customer.email,
          phone:    input.customer.phone,
          document: input.customer.document,
        },
      });
    } else {
      // Customer existe — preenche campos faltantes com o input, sem sobrescrever
      // dados que o cliente possa ter editado em outras rotas (área do cliente etc).
      const patch: any = {};
      if (!customer.document && input.customer.document) patch.document = input.customer.document;
      if (!customer.phone    && input.customer.phone)    patch.phone    = input.customer.phone;
      if (!customer.name && input.customer.name)         patch.name     = input.customer.name;
      if (Object.keys(patch).length) {
        try {
          customer = await (this.prisma as any).customer.update({
            where: { id: customer.id },
            data:  patch,
          });
        } catch (e: any) {
          // P2002 = violação de unique [document, tenantId] — outro customer
          // já tem esse CPF. Não quebra o checkout: prossegue com o customer
          // antigo sem document; LabelService vai detectar e avisar o admin.
          if (e?.code !== 'P2002') throw e;
          // eslint-disable-next-line no-console
          console.warn(`[order] customer ${customer.id} sem document salvo (CPF duplicado em outro cliente)`);
        }
      }
    }

    // 4. Cria Order (PENDING) — ainda sem ID externo de pagamento
    //
    // priority: 'URGENT' por padrão pra pedidos do ecommerce — cliente final
    // tá esperando produção e já pagou, então não pode misturar com fila
    // interna do PDV/orçamento que podem ter prazos mais flexíveis. Atendente
    // ainda pode rebaixar pra NORMAL pelo modal do kanban se quiser.
    const order = await (this.prisma as any).order.create({
      data: {
        tenantId,
        customerId:        customer.id,
        productDescription: lineItems.map(l => `${l.qty}× ${l.name}`).join(' · ').substring(0, 250),
        amount:            total,
        status:            'PENDING',
        priority:          'URGENT',
        details:           {
          items: lineItems,
          subtotal,
          shippingCost,
          total,
          ...(appliedCoupon && { coupon: appliedCoupon }),
          ...(loyaltyDiscount > 0 && { loyaltyRedeem: { points: redeemPointsApplied, cashback: redeemCashbackApplied, discount: loyaltyDiscount } }),
        },
        source:            'ECOMMERCE',
        shippingAddress:   input.shippingAddress as any,
        shippingService:   input.shippingService,
        shippingCarrier:   input.shippingCarrier,
        shippingCost:      shippingCost,
        paymentMethod:     input.paymentMethod,
        paymentStatus:     'PENDING',
        paymentInstallments: input.installments,
      },
    });

    // Aplica resgate de pontos/cashback (debita saldo do cliente, registra ledger).
    // Idempotente via Order.loyaltyDiscount já gravado, mas chamamos só uma vez.
    if (wantsRedeem && input.storeCustomerId && loyaltyDiscount > 0) {
      try {
        await this.loyalty.applyRedeem(tenantId, order.id, redeemPointsApplied, redeemCashbackApplied);
      } catch (err: any) {
        this.logger.warn(`Resgate falhou no order ${order.id}: ${err.message}`);
      }
    }

    // 5. Cria Payment no MP de acordo com o método
    const description = `Pedido #${order.id} — ${storeConfig.storeName || 'Loja'}`;
    const [firstName, ...lastNameParts] = (input.customer.name || 'Cliente').split(' ');
    const lastName = lastNameParts.join(' ') || 'Sobrenome';

    let paymentResult: any = {};
    try {
      if (input.paymentMethod === 'PIX') {
        // Gate: PIX exige feature PIX_PAYMENTS ativa no plano da loja
        const allowedPix = await this.checkFeature.check(tenantId, FeatureKey.PIX_PAYMENTS);
        if (!allowedPix) {
          throw new BadRequestException('Pagamento por PIX não disponível no plano desta loja.');
        }
        paymentResult = await this.mp.createPixPayment({
          amount: total,
          description,
          payerEmail:     input.customer.email,
          payerFirstName: firstName,
          payerLastName:  lastName,
          documentType:   input.customer.documentType,
          documentNumber: input.customer.document,
        });
      } else if (input.paymentMethod === 'CREDIT_CARD') {
        // Gate: cartão exige feature MP_CARD ativa no plano da loja
        const allowedCard = await this.checkFeature.check(tenantId, FeatureKey.MP_CARD);
        if (!allowedCard) {
          throw new BadRequestException('Pagamento por cartão não disponível no plano desta loja.');
        }
        if (!input.cardToken || !input.cardPaymentMethodId) {
          throw new BadRequestException('Token do cartão obrigatório');
        }
        paymentResult = await this.mp.createCardPayment({
          amount: total,
          description,
          payerEmail:        input.customer.email,
          cardToken:         input.cardToken,
          paymentMethodId:   input.cardPaymentMethodId,
          installments:      input.installments || 1,
          issuerId:          input.issuerId,
          documentType:      input.customer.documentType,
          documentNumber:    input.customer.document,
        });
      } else if (input.paymentMethod === 'BOLETO') {
        if (!input.customer.document || !input.customer.documentType) {
          throw new BadRequestException('Documento obrigatório para boleto');
        }
        paymentResult = await this.mp.createBoletoPayment({
          amount: total,
          description,
          payerEmail:     input.customer.email,
          payerFirstName: firstName,
          payerLastName:  lastName,
          documentType:   input.customer.documentType,
          documentNumber: input.customer.document,
          address: input.shippingAddress ? {
            zipCode: input.shippingAddress.cep,
            street:  input.shippingAddress.street,
            number:  input.shippingAddress.number,
            neighborhood: input.shippingAddress.neighborhood,
            city:    input.shippingAddress.city,
            state:   input.shippingAddress.state,
          } : undefined,
        });
      }
    } catch (e: any) {
      // Se o pagamento falhou, marca order como REJECTED mas mantém criada (auditoria)
      await (this.prisma as any).order.update({
        where: { id: order.id },
        data:  { paymentStatus: 'REJECTED' },
      });
      throw new BadRequestException(`Falha no pagamento: ${e.message}`);
    }

    // 6. Atualiza Order com referência externa do pagamento + status retornado
    const newStatus = paymentResult.status === 'approved' ? 'APPROVED'
                    : paymentResult.status === 'rejected' ? 'REJECTED'
                    : 'PENDING';

    await (this.prisma as any).order.update({
      where: { id: order.id },
      data: {
        paymentExternalId: paymentResult.id,
        paymentStatus:     newStatus,
      },
    });

    // 7. Se cartão aprovado, decrementa estoque (PIX/boleto só decrementa no webhook)
    if (input.paymentMethod === 'CREDIT_CARD' && newStatus === 'APPROVED') {
      await this.decrementStock(tenantId, lineItems);
    }

    // 7b. Incrementa contador de uso do cupom (mesmo se ainda PENDING — cliente já "comprometeu" o cupom)
    if (appliedCoupon) {
      await this.coupons.incrementUse(tenantId, appliedCoupon.code);
    }

    // 8. Dispara email de confirmação (não bloqueia a resposta)
    this.mailer.sendOrderConfirmation(tenantId, {
      orderId:         order.id,
      orderUuid:       order.uuid,
      customerName:    customer.name,
      customerEmail:   customer.email,
      amount:          total,
      paymentMethod:   input.paymentMethod,
      paymentStatus:   newStatus,
      items:           lineItems.map(l => ({ name: l.name, qty: l.qty, lineTotal: l.lineTotal })),
      shippingService: input.shippingService,
      shippingCost:    shippingCost,
      shippingAddress: input.shippingAddress,
      pixQrCode:       paymentResult.qrCode,
      pixQrCodeBase64: paymentResult.qrCodeBase64,
      boletoUrl:       paymentResult.boletoUrl,
      boletoBarcode:   paymentResult.barcode,
    }).catch(() => { /* erros de email já são logados no mailer */ });

    return {
      orderId:     order.id,
      orderUuid:   order.uuid,
      total,
      paymentMethod: input.paymentMethod,
      paymentStatus: newStatus,
      payment: {
        id:           paymentResult.id,
        // PIX
        qrCode:       paymentResult.qrCode,
        qrCodeBase64: paymentResult.qrCodeBase64,
        // PIX/Boleto
        paymentUrl:   paymentResult.paymentUrl,
        // Boleto
        boletoUrl:    paymentResult.boletoUrl,
        barcode:      paymentResult.barcode,
        expiresAt:    paymentResult.expiresAt,
        // Cartão
        statusDetail: paymentResult.statusDetail,
      },
    };
  }

  /**
   * Defesa em profundidade: já validamos os products no início do checkout
   * (`product.findMany({ where: { id in productIds, tenantId } })`), mas o
   * webhook usa items vindos do `order.details` (JSON) que pode estar
   * desatualizado ou ter sido manipulado em algum vetor futuro. updateMany
   * ancorando tenantId garante que NUNCA decrementamos estoque cross-tenant.
   */
  private async decrementStock(tenantId: number, items: { id: number; qty: number }[]) {
    for (const it of items) {
      await (this.prisma as any).product.updateMany({
        where: { id: it.id, tenantId },
        data:  { stock: { decrement: it.qty } },
      });
    }
  }

  /** Webhook do MP — atualiza paymentStatus e baixa estoque quando aprovado */
  async handlePaymentWebhook(paymentId: string) {
    const order = await (this.prisma as any).order.findFirst({
      where: { paymentExternalId: paymentId, source: 'ECOMMERCE' },
      include: { customer: true },
    });
    if (!order) return { ok: false, reason: 'order_not_found' };

    const status = await this.mp.getPaymentStatus(paymentId);
    const newStatus = status.status === 'approved' ? 'APPROVED'
                    : status.status === 'rejected' || status.status === 'cancelled' ? 'REJECTED'
                    : 'PENDING';

    if (newStatus === order.paymentStatus) return { ok: true, unchanged: true };

    await (this.prisma as any).order.update({
      where: { id: order.id },
      data: { paymentStatus: newStatus },
    });

    // Se passou pra APPROVED agora, decrementa estoque + dispara email
    if (newStatus === 'APPROVED' && order.paymentStatus !== 'APPROVED') {
      const items = (order.details as any)?.items || [];
      await this.decrementStock(order.tenantId, items.map((i: any) => ({ id: i.id, qty: i.qty })));

      this.mailer.sendPaymentApproved(order.tenantId, {
        orderId:       order.id,
        orderUuid:     order.uuid,
        customerName:  order.customer?.name || '',
        customerEmail: order.customer?.email || '',
        amount:        order.amount,
        paymentMethod: order.paymentMethod,
        paymentStatus: 'APPROVED',
        items:         items.map((i: any) => ({ name: i.name, qty: i.qty, lineTotal: i.lineTotal })),
      }).catch(() => { /* logado no mailer */ });
    }

    // Se passou pra REJECTED agora, dispara email de cancelamento (uma única vez)
    if (newStatus === 'REJECTED' && order.paymentStatus !== 'REJECTED') {
      const items = (order.details as any)?.items || [];
      this.mailer.sendOrderCancelled(order.tenantId, {
        orderId:       order.id,
        orderUuid:     order.uuid,
        customerName:  order.customer?.name || '',
        customerEmail: order.customer?.email || '',
        amount:        order.amount,
        paymentMethod: order.paymentMethod,
        paymentStatus: 'REJECTED',
        items:         items.map((i: any) => ({ name: i.name, qty: i.qty, lineTotal: i.lineTotal })),
      }).catch(() => { /* logado no mailer */ });
    }

    return { ok: true, status: newStatus };
  }

  async getOrderByUuid(tenantId: number, uuid: string) {
    return (this.prisma as any).order.findFirst({
      where: { uuid, tenantId },
      // document/phone necessários pro comprovante de retirada (atendente
      // confere CPF na hora do pickup). Endpoint protegido pelo UUID — só
      // quem tem o link consegue acessar.
      include: { customer: { select: { id: true, name: true, email: true, document: true, phone: true } } },
    });
  }

  /**
   * Sincroniza o status do pagamento direto com o Mercado Pago.
   * Útil quando o webhook não chegou (dev em localhost, redes restritas, etc.).
   * Reaproveita a lógica do webhook — mesmo efeito (atualiza order, decrementa estoque, dispara email).
   */
  async refreshPaymentStatus(tenantId: number, uuid: string) {
    const order = await (this.prisma as any).order.findFirst({
      where: { uuid, tenantId, source: 'ECOMMERCE' },
    });
    if (!order) throw new BadRequestException('Pedido não encontrado');
    if (!order.paymentExternalId) {
      return { ok: false, reason: 'no_payment_id', paymentStatus: order.paymentStatus };
    }
    if (order.paymentStatus === 'APPROVED') {
      return { ok: true, unchanged: true, paymentStatus: 'APPROVED' };
    }
    return this.handlePaymentWebhook(order.paymentExternalId);
  }

  /**
   * Reembolso total ou parcial via Mercado Pago + cancelamento do pedido.
   *
   * Fluxo:
   *   1. Valida pedido (existe, pagou, tem paymentExternalId, ainda não refundado)
   *   2. Chama MP /v1/payments/{id}/refunds (total se amount não informado)
   *   3. Atualiza Order: paymentStatus = REFUNDED, status = CANCELLED (só se total)
   *   4. Devolve estoque (decrementa em stock = soma + qty) — só refund total
   *   5. Salva motivo + valores em Order.details.refund
   *   6. Dispara email pro cliente avisando do estorno
   *
   * Reembolso parcial NÃO cancela o pedido nem devolve estoque — assume que o
   * cliente recebeu o produto mas houve compensação parcial (item avariado, etc).
   */
  async refundOrder(
    tenantId: number,
    orderId: number,
    opts: { amount?: number; reason?: string } = {},
  ) {
    const order = await (this.prisma as any).order.findFirst({
      where: { id: orderId, tenantId, source: 'ECOMMERCE' },
      include: { customer: true },
    });
    if (!order) throw new BadRequestException('Pedido não encontrado');

    if (!order.paymentExternalId) {
      throw new BadRequestException('Pedido sem ID de pagamento no Mercado Pago — não dá pra reembolsar.');
    }
    if (order.paymentStatus !== 'APPROVED') {
      throw new BadRequestException(
        `Pedido com status "${order.paymentStatus}" não pode ser reembolsado. Só pagamentos APPROVED são reembolsáveis.`
      );
    }
    if (order.paymentMethod === 'BOLETO' && opts.amount && opts.amount < Number(order.amount)) {
      throw new BadRequestException(
        'Mercado Pago não permite reembolso parcial de boleto — só total. Deixe o valor em branco.'
      );
    }
    // Valor parcial não pode exceder o pago
    if (opts.amount && opts.amount > Number(order.amount)) {
      throw new BadRequestException(
        `Valor do reembolso (R$ ${opts.amount.toFixed(2)}) maior que o pago (R$ ${Number(order.amount).toFixed(2)}).`
      );
    }
    if (opts.amount !== undefined && opts.amount <= 0) {
      throw new BadRequestException('Valor do reembolso deve ser maior que zero.');
    }

    const isFull = !opts.amount || Math.abs(opts.amount - Number(order.amount)) < 0.01;
    const refundAmount = opts.amount ?? Number(order.amount);

    // 1) Chama MP
    let mpResult: { id: string; amount: number; status: string; paymentStatus: string };
    try {
      mpResult = await this.mp.refundPayment(
        String(order.paymentExternalId),
        isFull ? undefined : refundAmount,
      );
    } catch (e: any) {
      // SDK do MP pode lançar erro com cause embutido
      const detail = e?.cause?.[0]?.description || e?.message || 'erro desconhecido';
      throw new BadRequestException(`Mercado Pago recusou o reembolso: ${detail}`);
    }

    // 2) Atualiza Order
    const newPaymentStatus = isFull ? 'REFUNDED' : 'PARTIAL_REFUND';
    const newStatus = isFull ? 'CANCELLED' : order.status;
    const refundEntry = {
      id:        mpResult.id,
      amount:    mpResult.amount,
      reason:    opts.reason || null,
      isFull,
      at:        new Date().toISOString(),
      mpStatus:  mpResult.paymentStatus,
    };
    const existingDetails = (order.details as any) || {};
    const refundsHistory = Array.isArray(existingDetails.refunds) ? existingDetails.refunds : [];

    await (this.prisma as any).order.updateMany({
      where: { id: order.id, tenantId },
      data: {
        paymentStatus: newPaymentStatus,
        status:        newStatus,
        details:       { ...existingDetails, refunds: [...refundsHistory, refundEntry] },
      },
    });

    // 3) Devolve estoque (só refund total — parcial assume produto entregue)
    if (isFull) {
      const items = (existingDetails.items as any[]) || [];
      for (const it of items) {
        if (!it?.id || !it?.qty) continue;
        try {
          await (this.prisma as any).product.update({
            where: { id: it.id },
            data:  { stock: { increment: it.qty } },
          });
        } catch {
          // Produto pode ter sido excluído — não bloqueia o refund
        }
      }
    }

    // 4) Email pro cliente (não bloqueia se falhar)
    try {
      await this.mailer.sendRefundConfirmation({
        to:           order.customer?.email,
        customerName: order.customer?.name || 'Cliente',
        orderRef:     String(order.id).padStart(5, '0'),
        amount:       mpResult.amount,
        isFull,
        reason:       opts.reason || '',
        tenantId,
      });
    } catch (e: any) {
      console.warn('[refundOrder] falha ao enviar email:', e?.message);
    }

    // 5) Audit — refund é evento financeiro crítico, sempre logar.
    await this.audit.logAction(
      null,
      'REFUND',
      'Order',
      order.id,
      {
        refundId: mpResult.id,
        amount: mpResult.amount,
        isFull,
        newPaymentStatus,
        reason: opts.reason || null,
        mpStatus: mpResult.paymentStatus,
      },
      tenantId,
    );

    return {
      ok:            true,
      isFull,
      refundId:      mpResult.id,
      paymentStatus: newPaymentStatus,
    };
  }
}
