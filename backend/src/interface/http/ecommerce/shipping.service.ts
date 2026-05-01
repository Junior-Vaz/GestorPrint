import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { CheckFeatureUseCase } from '../../../application/entitlement/check-feature.usecase';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';

export interface CalculateShippingInput {
  tenantId: number;
  destinationCep: string;
  items: { productId: number; qty: number }[];
}

export interface ShippingOption {
  id:           string;
  name:         string;       // ex: "PAC", "SEDEX", "Jadlog .Package"
  company:      string;       // ex: "Correios", "Jadlog"
  companyLogo:  string;
  price:        number;
  days:         number;
  customDeliveryTime?: { min: number; max: number };
  error?:       string;       // ex: "Excede dimensões máximas"
}

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkFeature: CheckFeatureUseCase,
  ) {}

  /** Default fallback dimensions (cm/g) — produtos sem dimensão usam isso */
  private readonly DEFAULT_DIM = { width: 11, height: 2, length: 16, weight: 100 };

  async calculate(input: CalculateShippingInput): Promise<{ options: ShippingOption[] }> {
    const { tenantId, destinationCep, items } = input;
    const cleanCep = (destinationCep || '').replace(/\D/g, '');
    if (cleanCep.length !== 8) throw new BadRequestException('CEP de destino inválido');
    if (!items?.length) throw new BadRequestException('Carrinho vazio');

    // 1. Lê settings (origem + token Melhor Envios + pickup)
    const settings = await (this.prisma as any).settings.findUnique({ where: { tenantId } });
    const sc       = settings?.storeConfig || {};
    const pickupEnabled = !!sc.pickupEnabled;
    const pickupAddress = String(sc.pickupAddress || '');

    // Retirada na loja é independente do Melhor Envios — sempre disponível
    // quando o admin habilitar. Vai como primeira opção (R$ 0, dias 0).
    const pickupOption: ShippingOption | null = pickupEnabled ? {
      id:          'pickup',
      name:        'Retirar na loja',
      company:     pickupAddress || 'Loja',
      companyLogo: '',
      price:       0,
      days:        0,
    } : null;

    // Gate de feature dentro do service (controller é @Public — checkout sem auth)
    const allowed = await this.checkFeature.check(tenantId, FeatureKey.MELHOR_ENVIOS);
    if (!allowed) {
      // Sem ME no plano: ainda dá pra oferecer retirada. Se nem retirada estiver
      // habilitada, aí sim trava o checkout — não tem como entregar.
      if (pickupOption) return { options: [pickupOption] };
      throw new BadRequestException('Cálculo de frete via Melhor Envios não está disponível no plano desta loja.');
    }

    const originCep = (settings?.originCep || '').replace(/\D/g, '');
    if (!originCep || originCep.length !== 8) {
      // Sem CEP de origem: idem — só retirada se estiver habilitada.
      if (pickupOption) return { options: [pickupOption] };
      throw new BadRequestException('CEP de origem não configurado nas configurações da loja');
    }
    const token = settings?.meAccessToken;
    const env = settings?.meEnvironment || 'sandbox';

    // Sem token configurado → bloqueia o cálculo via transportadora. Antes
    // existia um fallback estimado (preço × peso) que entregava DADOS FALSOS
    // pro cliente. Agora: se houver retirada habilitada, oferece só ela; senão
    // trava o checkout e força o admin a configurar o token.
    if (!token) {
      if (pickupOption) return { options: [pickupOption] };
      throw new BadRequestException(
        'Cálculo de frete indisponível: a loja ainda não configurou o token do Melhor Envios. ' +
        'Tente novamente em alguns minutos ou fale com a loja pelo WhatsApp.'
      );
    }

    // 2. Carrega produtos pra ter dimensões + preços
    const productIds = items.map(i => i.productId);
    const products = await (this.prisma as any).product.findMany({
      where: { id: { in: productIds }, tenantId },
    });
    const byId = new Map(products.map((p: any) => [p.id, p]));

    const meProducts = items.map(it => {
      const p: any = byId.get(it.productId);
      if (!p) throw new BadRequestException(`Produto ${it.productId} não encontrado`);
      return {
        id:              String(p.id),
        width:           Number(p.widthCm  || this.DEFAULT_DIM.width),
        height:          Number(p.heightCm || this.DEFAULT_DIM.height),
        length:          Number(p.lengthCm || this.DEFAULT_DIM.length),
        weight:          Number((p.weightGrams || this.DEFAULT_DIM.weight) / 1000), // ME usa kg
        insurance_value: Number(p.unitPrice || 0),
        quantity:        it.qty,
      };
    });

    // 3. Chama Melhor Envios (única fonte de verdade — sem fallback estimado)
    const baseUrl = env === 'production'
      ? 'https://melhorenvio.com.br'
      : 'https://sandbox.melhorenvio.com.br';
    const url = `${baseUrl}/api/v2/me/shipment/calculate`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept':         'application/json',
          'Content-Type':   'application/json',
          'Authorization':  `Bearer ${token}`,
          'User-Agent':     'GestorPrint Ecommerce (admin@gestorprint.com.br)',
        },
        body: JSON.stringify({
          from:     { postal_code: originCep },
          to:       { postal_code: cleanCep },
          products: meProducts,
          options:  { receipt: false, own_hand: false, insurance_value: meProducts.reduce((s, p) => s + p.insurance_value * p.quantity, 0) },
        }),
      });
    } catch (e: any) {
      // Falha de rede (DNS, timeout, ME fora do ar). Bloqueia em vez de devolver
      // dados estimados — preço errado de frete = prejuízo pra loja ou pro cliente.
      // Mas se retirada estiver habilitada, ainda oferece ela.
      console.error('[ShippingService] Falha ao consultar Melhor Envios:', e.message);
      if (pickupOption) return { options: [pickupOption] };
      throw new BadRequestException(
        'Não foi possível calcular o frete agora — o serviço de transportadoras está indisponível. ' +
        'Tente novamente em alguns minutos.'
      );
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[ShippingService] Melhor Envios retornou erro HTTP:', res.status, errBody);
      // Falha do ME mas retirada habilitada → oferece só retirada (cliente
      // ainda consegue finalizar). Senão, bloqueia.
      if (pickupOption) return { options: [pickupOption] };
      // 401/403 = token expirado/inválido — admin precisa renovar
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          'Cálculo de frete indisponível: token do Melhor Envios expirado ou inválido. ' +
          'Fale com a loja pelo WhatsApp pra finalizar o pedido.'
        );
      }
      throw new BadRequestException(
        'Não foi possível calcular o frete agora. Tente novamente em alguns minutos.'
      );
    }

    const data: any[] = await res.json();
    const options: ShippingOption[] = data
      .filter(s => !s.error || s.price)         // remove serviços indisponíveis
      .map(s => ({
        id:          String(s.id),
        name:        s.name,
        company:     s.company?.name || '',
        companyLogo: s.company?.picture || '',
        price:       Number(s.price || 0),
        days:        Number(s.delivery_time || 0),
        customDeliveryTime: s.custom_delivery_range || s.delivery_range
          ? { min: s.custom_delivery_range?.min ?? s.delivery_range?.min ?? 0,
              max: s.custom_delivery_range?.max ?? s.delivery_range?.max ?? 0 }
          : undefined,
        error: s.error,
      }))
      .sort((a, b) => a.price - b.price);

    // ME respondeu OK mas SEM nenhuma opção válida (todos os serviços devolveram
    // erro — geralmente por dimensões fora do limite ou rota inexistente).
    // Se retirada habilitada, oferece só ela. Senão bloqueia — sem como entregar.
    if (options.length === 0) {
      if (pickupOption) return { options: [pickupOption] };
      throw new BadRequestException(
        'Nenhuma transportadora disponível pra esse CEP com os itens do carrinho. ' +
        'Verifique o CEP ou entre em contato com a loja.'
      );
    }

    // Retirada na loja vai como PRIMEIRA opção (R$ 0 — quase sempre é a mais
    // atrativa pro cliente que mora perto). Transportadoras vêm em seguida.
    return { options: pickupOption ? [pickupOption, ...options] : options };
  }
}
