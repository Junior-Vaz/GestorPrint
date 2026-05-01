import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../auth/decorators/public.decorator';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Endpoints de anexos do pedido pra cliente final do ecommerce.
 * Acesso protegido pelo UUID do pedido — quem tem o link consegue acessar
 * (mesmo padrão de PedidoConfirmado.vue / AcompanharPedido.vue).
 *
 * Reusa FilesService (compartilhado com o ERP), só blinda os checks:
 *  - Validação de extensão/tamanho (mesma do uso interno)
 *  - Cliente só pode REMOVER anexo enquanto o pedido tá em PENDING/PRODUCTION
 *    (depois que finaliza, fica travado — atendente da loja é quem mexe)
 *  - Limita 10 anexos por pedido (proteção contra abuso/storage flood)
 */

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.ps1', '.psm1', '.vbs', '.vbe',
  '.js', '.jse', '.wsf', '.wsh', '.scr', '.pif', '.reg', '.inf', '.cpl',
  '.sh', '.bash', '.zsh', '.fish', '.py', '.rb', '.pl', '.php', '.jar',
  '.dll', '.so', '.dylib', '.app', '.dmg', '.pkg', '.deb', '.rpm',
]);
const MAX_FILE_SIZE   = 50 * 1024 * 1024;   // 50 MB
const MAX_ATTACHMENTS = 10;                 // por pedido

@Public()
@Controller('ecommerce/orders')
export class OrderAttachmentsController {
  constructor(
    private readonly files: FilesService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Upload de arte/arquivo. Multipart, campo `file`. Retorna o anexo criado
   * com filename interno (pra montar URL de download).
   */
  @Post(':uuid/attachments')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits:  { fileSize: MAX_FILE_SIZE },
  }))
  async upload(
    @Param('uuid') uuid: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    // Validação extra (multer já corta no fileSize, mas ext precisa checagem própria)
    const lower = (file.originalname || '').toLowerCase();
    const ext = lower.includes('.') ? lower.substring(lower.lastIndexOf('.')) : '';
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${ext}. Use PDF, JPG, PNG, AI, PSD ou similar.`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Arquivo maior que 50 MB.');
    }

    const order = await this.findOrder(uuid);

    // Limite de quantidade — proteção contra abuso
    const count = await (this.prisma as any).attachment.count({ where: { orderId: order.id } });
    if (count >= MAX_ATTACHMENTS) {
      throw new BadRequestException(
        `Limite de ${MAX_ATTACHMENTS} arquivos por pedido atingido. Remova um arquivo antes de enviar outro.`,
      );
    }

    return this.files.saveFile(order.id, file, order.tenantId);
  }

  /** Lista todos os anexos do pedido. */
  @Get(':uuid/attachments')
  async list(@Param('uuid') uuid: string) {
    const order = await this.findOrder(uuid);
    return this.files.findByOrder(order.id);
  }

  /**
   * Remove anexo. Cliente só consegue se o pedido AINDA não foi finalizado —
   * depois que entra na produção, atendente bloqueia mexer.
   */
  @Delete(':uuid/attachments/:id')
  async remove(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const order = await this.findOrder(uuid);

    // Status onde cliente AINDA pode remover anexo
    const removable = ['PENDING', 'PRODUCTION'];
    if (!removable.includes(order.status)) {
      throw new BadRequestException(
        'Não é mais possível remover anexos — o pedido já foi finalizado. ' +
        'Fale com a loja pelo WhatsApp se precisar trocar a arte.',
      );
    }

    // Verifica que o attachment é do mesmo pedido (defesa contra IDOR)
    const att = await (this.prisma as any).attachment.findUnique({ where: { id } });
    if (!att || att.orderId !== order.id) {
      throw new NotFoundException('Anexo não encontrado neste pedido');
    }

    await this.files.remove(id);
    return { ok: true };
  }

  /**
   * Atualiza observações do cliente sobre o pedido (ex: cor preferida,
   * detalhes de personalização, instruções extras). Salva em
   * `Order.details.customerNotes` — admin enxerga junto com o pedido no ERP.
   *
   * Sem versionamento (sobrescreve direto). Limite 2000 chars pra não
   * inflar o JSON do Order com texto longo demais.
   */
  @Patch(':uuid/notes')
  async updateNotes(
    @Param('uuid') uuid: string,
    @Body() body: { notes?: string },
  ) {
    const order = await this.findOrder(uuid);

    // Cliente não pode editar nota depois que pedido finalizou (mesma regra
    // do remove — preserva histórico do que foi acordado).
    const editable = ['PENDING', 'PRODUCTION'];
    if (!editable.includes(order.status)) {
      throw new BadRequestException('Não é mais possível editar observações deste pedido.');
    }

    const notes = String(body?.notes ?? '').slice(0, 2000);
    const newDetails = { ...(order.details as any || {}), customerNotes: notes };

    await (this.prisma as any).order.update({
      where: { id: order.id },
      data:  { details: newDetails },
    });
    return { ok: true, notes };
  }

  /**
   * Helper: busca o pedido pelo UUID. Encapsula o NotFound + check de
   * source=ECOMMERCE (não permite mexer em pedidos do PDV via essa rota).
   */
  private async findOrder(uuid: string) {
    const order = await (this.prisma as any).order.findFirst({
      where: { uuid, source: 'ECOMMERCE' },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }
}
