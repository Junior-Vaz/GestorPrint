import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { IMercadoPagoGateway } from '../../application/payments/payment-repository.interface';

@Injectable()
export class MercadoPagoGateway implements IMercadoPagoGateway {
  private client: MercadoPagoConfig | null = null;
  private cachedToken: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async getClient(): Promise<MercadoPagoConfig | null> {
    const settings = await (this.prisma as any).settings.findUnique({ where: { id: 1 } });
    const accessToken = settings?.mpAccessToken;
    if (!accessToken) return null;

    if (!this.client || this.cachedToken !== accessToken) {
      this.client = new MercadoPagoConfig({ accessToken });
      this.cachedToken = accessToken;
    }
    return this.client;
  }

  async isConfigured(): Promise<boolean> {
    const settings = await (this.prisma as any).settings.findUnique({ where: { id: 1 } });
    return !!settings?.mpAccessToken;
  }

  async createPixPayment(data: {
    amount: number;
    description: string;
    payerEmail: string;
    payerFirstName: string;
    payerLastName: string;
    documentType?: 'CPF' | 'CNPJ';
    documentNumber?: string;
  }): Promise<{ id: string; paymentUrl?: string; qrCode?: string; qrCodeBase64?: string }> {
    const client = await this.getClient();
    if (!client) throw new Error('Mercado Pago not configured');

    const payment = new Payment(client);
    const body: any = {
      transaction_amount: data.amount,
      description: data.description,
      payment_method_id: 'pix',
      payer: {
        email: data.payerEmail,
        first_name: data.payerFirstName,
        last_name: data.payerLastName,
      },
    };

    if (data.documentType && data.documentNumber) {
      body.payer.identification = {
        type: data.documentType,
        number: data.documentNumber,
      };
    }

    const response: any = await payment.create({ body });
    return {
      id: response.id?.toString(),
      paymentUrl: response.point_of_interaction?.transaction_data?.ticket_url || response.init_point,
      qrCode: response.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
    };
  }

  async createCardPayment(data: {
    amount: number;
    description: string;
    payerEmail: string;
    cardToken: string;             // gerado no frontend pela SDK do MP
    paymentMethodId: string;       // ex: "visa", "master"
    installments: number;
    issuerId?: string;
    documentType?: 'CPF' | 'CNPJ';
    documentNumber?: string;
  }): Promise<{ id: string; status: string; statusDetail?: string }> {
    const client = await this.getClient();
    if (!client) throw new Error('Mercado Pago not configured');

    const payment = new Payment(client);
    const body: any = {
      transaction_amount: data.amount,
      description:        data.description,
      token:              data.cardToken,
      installments:       data.installments,
      payment_method_id:  data.paymentMethodId,
      issuer_id:          data.issuerId,
      payer:              { email: data.payerEmail },
    };
    if (data.documentType && data.documentNumber) {
      body.payer.identification = { type: data.documentType, number: data.documentNumber };
    }

    const response: any = await payment.create({ body });
    return {
      id: response.id?.toString(),
      status: response.status,           // approved | rejected | in_process | etc
      statusDetail: response.status_detail,
    };
  }

  async createBoletoPayment(data: {
    amount: number;
    description: string;
    payerEmail: string;
    payerFirstName: string;
    payerLastName: string;
    documentType: 'CPF' | 'CNPJ';
    documentNumber: string;
    address?: { zipCode: string; street: string; number: string; neighborhood: string; city: string; state: string };
  }): Promise<{ id: string; status: string; boletoUrl?: string; barcode?: string; expiresAt?: string }> {
    const client = await this.getClient();
    if (!client) throw new Error('Mercado Pago not configured');

    const payment = new Payment(client);
    const body: any = {
      transaction_amount: data.amount,
      description:        data.description,
      payment_method_id:  'bolbradesco',
      payer: {
        email:      data.payerEmail,
        first_name: data.payerFirstName,
        last_name:  data.payerLastName,
        identification: { type: data.documentType, number: data.documentNumber },
      },
    };
    if (data.address) {
      body.payer.address = {
        zip_code:     data.address.zipCode,
        street_name:  data.address.street,
        street_number: data.address.number,
        neighborhood: data.address.neighborhood,
        city:         data.address.city,
        federal_unit: data.address.state,
      };
    }

    const response: any = await payment.create({ body });
    return {
      id: response.id?.toString(),
      status: response.status,
      boletoUrl: response.transaction_details?.external_resource_url,
      barcode:   response.barcode?.content,
      expiresAt: response.date_of_expiration,
    };
  }

  async getPaymentStatus(gatewayId: string): Promise<{ status: string }> {
    const client = await this.getClient();
    if (!client) throw new Error('Mercado Pago not configured');

    const payment = new Payment(client);
    const details: any = await payment.get({ id: gatewayId });
    return { status: details.status };
  }

  /**
   * Reembolsa um pagamento (total ou parcial) via Mercado Pago.
   * - amount omitido → reembolso TOTAL (devolve o valor inteiro)
   * - amount informado → reembolso PARCIAL (apenas esse valor)
   *
   * Regras MP:
   * - Pagamento precisa estar `approved` pra reembolsar
   * - Reembolso parcial não é permitido pra boleto (só total)
   * - Após o estorno, status do payment vira `refunded` (total) ou
   *   `partially_refunded` (parcial)
   * - Idempotency-Key recomendado pra evitar duplicação em retries
   *
   * Retorna o ID do refund gerado, valor e status.
   * Docs: https://www.mercadopago.com.br/developers/pt/reference/chargebacks/_payments_id_refunds/post
   */
  async refundPayment(paymentId: string, amount?: number): Promise<{
    id: string;
    amount: number;
    status: string;
    paymentStatus: string;
  }> {
    const client = await this.getClient();
    if (!client) throw new Error('Mercado Pago not configured');

    const refund = new PaymentRefund(client);
    const body: any = {};
    if (typeof amount === 'number' && amount > 0) {
      body.amount = Number(amount.toFixed(2));   // MP exige 2 casas decimais
    }

    const response: any = await refund.create({
      payment_id: paymentId,
      body,
      requestOptions: {
        idempotencyKey: `refund-${paymentId}-${Date.now()}`,
      },
    });

    // Após o refund, busca o payment pra saber o novo status (refunded / partially_refunded)
    const payment = new Payment(client);
    const updated: any = await payment.get({ id: paymentId });

    return {
      id:            response.id?.toString(),
      amount:        Number(response.amount),
      status:        response.status,            // approved | rejected
      paymentStatus: updated.status,             // refunded | partially_refunded | approved
    };
  }
}
