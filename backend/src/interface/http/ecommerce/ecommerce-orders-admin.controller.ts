import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
// Alias pra evitar colisão com `Response` global do fetch (DOM/Node 18+).
// Sem isso, declarar `let upstream: Response` deduzia o Express Response e
// quebrava no .ok/.text()/.arrayBuffer() (que pertencem ao fetch Response).
import type { Response as ExpressResponse } from 'express';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { EcommerceOrdersAdminService } from './ecommerce-orders-admin.service';
import { LabelService } from './label.service';
import { EcommerceOrdersService } from './ecommerce-orders.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@RequireFeature(FeatureKey.ECOMMERCE)
@Controller('ecommerce/admin/orders')
export class EcommerceOrdersAdminController {
  constructor(
    private readonly svc: EcommerceOrdersAdminService,
    private readonly labelSvc: LabelService,
    private readonly ordersSvc: EcommerceOrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  @CanAccess('ecommerce-orders', 'view')
  stats(@CurrentTenant() tenantId: number) {
    return this.svc.stats(tenantId);
  }

  @Get()
  @CanAccess('ecommerce-orders', 'view')
  list(
    @CurrentTenant() tenantId: number,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('search') search?: string,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const page     = pageQ     ? parseInt(pageQ, 10)     : 1;
    const pageSize = pageSizeQ ? parseInt(pageSizeQ, 10) : 20;
    return this.svc.list(tenantId, { status, paymentStatus, search }, page, pageSize);
  }

  @Get(':id')
  @CanAccess('ecommerce-orders', 'view')
  getOne(@CurrentTenant() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.getOne(tenantId, id);
  }

  @Patch(':id/status')
  @CanAccess('ecommerce-orders', 'edit')
  updateStatus(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.svc.updateStatus(tenantId, id, body.status);
  }

  @Patch(':id/shipping')
  @CanAccess('ecommerce-orders', 'edit')
  updateShipping(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { trackingCode?: string; shippingStatus?: string; shippingLabelUrl?: string },
  ) {
    return this.svc.updateShipping(tenantId, id, body);
  }

  /** Compra etiqueta no Melhor Envios e devolve URL do PDF */
  @Post(':id/label')
  @CanAccess('ecommerce-orders', 'edit')
  buyLabel(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.labelSvc.buyLabel(tenantId, id);
  }

  /**
   * Download direto do PDF da etiqueta — atendente baixa pelo nosso domínio
   * sem ir pro painel ME.
   *
   * Importante: NÃO usa `shippingLabelUrl` (que é a URL da página HTML
   * `/imprimir/...` retornada por POST /shipment/print — essa rota devolve
   * uma página web, não o PDF). Em vez disso, chama o endpoint específico
   * de impressão em arquivo:
   *
   *   GET /api/v2/me/imprimir/pdf/{meShipmentId}
   *
   * Esse endpoint responde com a URL de um arquivo PDF hospedado no S3 do
   * ME (`me-0047-prod.s3.amazonaws.com/...`), que é PÚBLICA e pode ser
   * baixada sem token. Pegamos essa URL, fazemos fetch dela e servimos o
   * binário pro nosso cliente. Docs: docs.melhorenvio.com.br → "Impressão
   * de etiquetas em arquivo".
   *
   * Auth do nosso lado: JWT em ?token= (suportado pelo JwtStrategy.fromExtractors).
   */
  @Get(':id/label/download')
  @CanAccess('ecommerce-orders', 'view')
  async downloadLabel(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: ExpressResponse,
  ) {
    const order = await (this.prisma as any).order.findFirst({
      where:  { id, tenantId, source: 'ECOMMERCE' },
      select: { id: true, meShipmentId: true, shippingLabelUrl: true, trackingCode: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (!order.meShipmentId) {
      throw new BadRequestException(
        'Etiqueta ainda não foi gerada para este pedido. Gere primeiro em "Comprar etiqueta".'
      );
    }

    // Carrega token + ambiente do ME
    const settings = await (this.prisma as any).settings.findUnique({
      where:  { tenantId },
      select: { meAccessToken: true, meEnvironment: true },
    });
    const meToken = settings?.meAccessToken;
    if (!meToken) {
      throw new BadRequestException('Token Melhor Envios não configurado');
    }
    const baseUrl = settings?.meEnvironment === 'production'
      ? 'https://melhorenvio.com.br'
      : 'https://sandbox.melhorenvio.com.br';

    // 1) Pede ao ME a URL do PDF (S3) pro envio
    const meHeaders: Record<string, string> = {
      'Accept':         'application/json',
      'Content-Type':   'application/json',
      'Authorization':  `Bearer ${meToken}`,
      'User-Agent':     'GestorPrint Ecommerce (admin@gestorprint.com.br)',
    };

    let pdfUrl: string;
    try {
      const printRes = await fetch(
        `${baseUrl}/api/v2/me/imprimir/pdf/${order.meShipmentId}`,
        { method: 'GET', headers: meHeaders },
      );
      const txt = await printRes.text();
      if (!printRes.ok) {
        throw new BadRequestException(
          `Melhor Envios respondeu ${printRes.status} ao gerar link do PDF. ` +
          (printRes.status === 401 || printRes.status === 403
            ? 'Token expirado — atualize em ERP → Configurações → Envio.'
            : txt.slice(0, 250))
        );
      }
      // Resposta REAL do ME (testado em produção 2026-04-30):
      //   ["https://me-0047-prod.s3.amazonaws.com/pdf/{shipmentId}-1.pdf?X-Amz-..."]
      // É um ARRAY com a URL pré-assinada do S3. A doc oficial mostra
      // `{"https://..."}` mas isso é JSON inválido — na prática vem array.
      // Mantém os outros formatos como fallback caso a API mude.
      let parsed: any = null;
      try { parsed = JSON.parse(txt); } catch { /* não-JSON */ }
      pdfUrl =
        (typeof parsed === 'string' && parsed) ||
        (Array.isArray(parsed) && typeof parsed[0] === 'string' && parsed[0]) ||
        parsed?.url ||
        parsed?.pdf ||
        parsed?.[String(order.meShipmentId)] ||
        '';
      // Fallback final: extrai a primeira URL https do texto cru.
      // Nota: as URLs S3 do ME contêm query params com `&` `=` `%` — todos
      // permitidos pelo charclass `[^\s"',\]}]+`. Excluí `]` também porque o
      // body é um array JSON e a URL fecha com `]`.
      if (!pdfUrl) {
        const match = txt.match(/https?:\/\/[^\s"',\]}]+/i);
        if (match) pdfUrl = match[0].replace(/[",\]}]+$/, '');
      }
      if (!pdfUrl) {
        throw new BadRequestException(
          `Melhor Envios não retornou URL do PDF. Resposta: ${txt.slice(0, 200)}`
        );
      }

      // VALIDAÇÃO CRÍTICA — distingue PDF real (S3/CloudFront) de página HTML.
      // Em sandbox, ME só gera arquivo PDF pra serviços da Jadlog. Pra qualquer
      // outra transportadora (Correios, Loggi, etc), ele devolve a URL da
      // página `melhorenvio.com.br/imprimir/HASH` — que é HTML, não PDF.
      // Antes a gente baixava esse HTML e o browser abria um arquivo .pdf
      // corrompido, dando "Unsafe attempt to load file: URL".
      const isRealPdf =
        /amazonaws\.com|cloudfront\.net|s3\./i.test(pdfUrl) ||
        /\.pdf(\?|$)/i.test(pdfUrl);
      const isHtmlPage = /\/imprimir\/[a-z0-9]+/i.test(pdfUrl) && !/\.pdf/i.test(pdfUrl);

      if (isHtmlPage || !isRealPdf) {
        const env = settings?.meEnvironment || 'sandbox';
        throw new BadRequestException(
          env === 'sandbox'
            ? `O Melhor Envios sandbox só gera PDF pra serviços da Jadlog. ` +
              `Pra esta transportadora, baixe pelo painel ME ou troque pra produção. ` +
              `URL retornada: ${pdfUrl.slice(0, 100)}`
            : `Melhor Envios retornou link de página HTML em vez de PDF (${pdfUrl.slice(0, 100)}). ` +
              `Tente regerar a etiqueta — pode ser problema temporário do gateway.`
        );
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        `Falha ao solicitar PDF da etiqueta ao Melhor Envios: ${e?.message || 'erro desconhecido'}.`
      );
    }

    // 2) Baixa o PDF do S3 (URL pública, sem token)
    let upstream: Response;
    try {
      upstream = await fetch(pdfUrl, {
        headers: { 'Accept': 'application/pdf,*/*' },
        redirect: 'follow',
      });
    } catch (e: any) {
      throw new BadRequestException(`Falha de rede ao baixar PDF: ${e?.message}.`);
    }

    if (!upstream.ok) {
      throw new BadRequestException(
        `Falha ao baixar PDF (${upstream.status}) de ${pdfUrl.slice(0, 80)}. Tente novamente.`
      );
    }

    const contentType = upstream.headers.get('content-type') || '';
    const buf = await upstream.arrayBuffer();
    const bytes = new Uint8Array(buf);

    // Validação definitiva: magic bytes do PDF (`%PDF-`). Mesmo se o S3 mentir
    // no Content-Type, os primeiros 5 bytes do arquivo identificam um PDF
    // real. Se não bater, mostra preview do conteúdo pra ajudar diagnóstico.
    const magic = String.fromCharCode(...bytes.slice(0, 5));
    if (magic !== '%PDF-') {
      const preview = new TextDecoder('utf-8', { fatal: false })
        .decode(bytes.slice(0, 400))
        .replace(/\s+/g, ' ')
        .trim();
      const env = settings?.meEnvironment || 'sandbox';
      const isHtml = /<html|<!doctype/i.test(preview);
      throw new BadRequestException(
        isHtml
          ? `O arquivo retornado é HTML, não PDF. ` +
            (env === 'sandbox'
              ? `Sandbox só gera PDF pra serviços da Jadlog. Use produção ou troque o serviço.`
              : `Tente regerar a etiqueta — pode ser problema temporário do Melhor Envios.`)
          : `Arquivo inválido (magic="${magic}", content-type="${contentType}"). ${preview.slice(0, 150)}`
      );
    }

    const orderRef = String(order.id).padStart(5, '0');
    const trackPart = order.trackingCode ? `-${order.trackingCode}` : '';
    const filename = `etiqueta-pedido-${orderRef}${trackPart}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.byteLength.toString());
    // no-store evita cache de respostas erradas — se o admin baixou um lixo
    // antes do fix, na próxima tentativa o browser não reusa o blob ruim
    res.setHeader('Cache-Control', 'no-store');
    res.end(Buffer.from(buf));
  }

  /**
   * Pré-visualização da etiqueta como imagem JPEG inline — pra mostrar no
   * modal do admin sem precisar baixar PDF. Usa o endpoint `/orders/{id}`
   * do ME que retorna estrutura completa do envio incluindo `files.1.jpeg`
   * (URL S3 pré-assinada da etiqueta como imagem). Mais leve que PDF e
   * renderiza nativamente em `<img>`.
   *
   * Acesse: GET /api/ecommerce/admin/orders/:id/label/preview?token=JWT
   */
  @Get(':id/label/preview')
  @CanAccess('ecommerce-orders', 'view')
  async previewLabel(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: ExpressResponse,
  ) {
    const order = await (this.prisma as any).order.findFirst({
      where:  { id, tenantId, source: 'ECOMMERCE' },
      select: { id: true, meShipmentId: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (!order.meShipmentId) {
      throw new BadRequestException('Etiqueta ainda não foi gerada para este pedido.');
    }

    const settings = await (this.prisma as any).settings.findUnique({
      where:  { tenantId },
      select: { meAccessToken: true, meEnvironment: true },
    });
    const meToken = settings?.meAccessToken;
    if (!meToken) throw new BadRequestException('Token Melhor Envios não configurado');

    const baseUrl = settings?.meEnvironment === 'production'
      ? 'https://melhorenvio.com.br'
      : 'https://sandbox.melhorenvio.com.br';

    // 1) Busca dados completos do envio — `files.1.jpeg` tem a URL S3 da imagem
    let jpegUrl: string;
    try {
      const orderRes = await fetch(
        `${baseUrl}/api/v2/me/orders/${order.meShipmentId}`,
        {
          method: 'GET',
          headers: {
            'Accept':         'application/json',
            'Content-Type':   'application/json',
            'Authorization':  `Bearer ${meToken}`,
            'User-Agent':     'GestorPrint Ecommerce (admin@gestorprint.com.br)',
          },
        },
      );
      if (!orderRes.ok) {
        const t = await orderRes.text().catch(() => '');
        throw new BadRequestException(
          `Melhor Envios respondeu ${orderRes.status} ao buscar dados do envio. ` +
          (orderRes.status === 401 || orderRes.status === 403
            ? 'Token expirado.'
            : t.slice(0, 200))
        );
      }
      const data = await orderRes.json();
      // Estrutura: { files: { "1": { jpeg, zpl, pdf }, dace: {...} } }
      jpegUrl = data?.files?.['1']?.jpeg || '';
      if (!jpegUrl) {
        throw new BadRequestException(
          'Pré-visualização indisponível — etiqueta ainda não foi gerada como imagem pelo Melhor Envios.'
        );
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        `Falha ao buscar pré-visualização: ${e?.message || 'erro desconhecido'}.`
      );
    }

    // 2) Faz proxy do JPEG do S3
    let upstream: Response;
    try {
      upstream = await fetch(jpegUrl, {
        headers: { 'Accept': 'image/jpeg,image/*,*/*' },
        redirect: 'follow',
      });
    } catch (e: any) {
      throw new BadRequestException(`Falha de rede ao baixar pré-visualização: ${e?.message}.`);
    }

    if (!upstream.ok) {
      throw new BadRequestException(`Falha ao baixar imagem (${upstream.status}). Tente novamente.`);
    }

    const buf = await upstream.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Magic bytes da JPEG: 0xFF 0xD8 0xFF. Garante que não estamos servindo HTML.
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    if (!isJpeg) {
      throw new BadRequestException('Arquivo retornado não é uma imagem JPEG válida.');
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline');                    // mostra inline, não baixa
    res.setHeader('Content-Length', buf.byteLength.toString());
    res.setHeader('Cache-Control', 'private, max-age=600');            // cache 10min — URL S3 expira em 30min
    res.end(Buffer.from(buf));
  }

  /** Sincroniza status do pagamento direto com o Mercado Pago */
  @Post(':id/refresh-payment')
  @CanAccess('ecommerce-orders', 'edit')
  async refreshPayment(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const order = await this.svc.getOne(tenantId, id);
    return this.ordersSvc.refreshPaymentStatus(tenantId, order.uuid);
  }

  /**
   * Reembolso (total ou parcial) via Mercado Pago. Só ADMIN — operação financeira
   * sensível. Refund total cancela o pedido e devolve estoque automaticamente.
   * Refund parcial mantém o pedido aberto (assume produto entregue, compensação parcial).
   */
  @Post(':id/refund')
  @CanAccess('ecommerce-orders', 'edit')
  async refund(
    @CurrentTenant() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { amount?: number; reason?: string },
  ) {
    return this.ordersSvc.refundOrder(tenantId, id, {
      amount: typeof body?.amount === 'number' ? body.amount : undefined,
      reason: body?.reason,
    });
  }
}
