import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Encriptador de credenciais sensíveis (geminiKey, evolutionKey, etc).
 *
 * Algoritmo: AES-256-GCM
 *   - 12 bytes IV aleatório por valor (best practice GCM)
 *   - 16 bytes auth tag — detecta tampering
 *   - Chave master de 32 bytes via env ENCRYPTION_KEY (hex 64 ou base64)
 *
 * Formato armazenado: `enc:v1:<base64(iv|tag|ciphertext)>`
 *   - O prefixo permite migração lazy: valores antigos em texto puro são
 *     detectados (sem prefixo) e re-encriptados na próxima save sem perder
 *     dados.
 *   - O `v1` deixa espaço pra rotação de algoritmo no futuro sem quebrar.
 *
 * Sem ENCRYPTION_KEY no env (ou ainda com placeholder), encrypt/decrypt
 * viram no-op (devolvem o input). Útil em dev local — em prod, configure
 * SEMPRE com 32 bytes reais.
 *
 * Como gerar a chave em dev:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
@Injectable()
export class CredentialEncryptor {
  private readonly logger = new Logger(CredentialEncryptor.name);
  private readonly key:    Buffer | null;
  private readonly enabled: boolean;

  static readonly PREFIX  = 'enc:v1:';
  static readonly ALG     = 'aes-256-gcm';
  static readonly IV_LEN  = 12;
  static readonly TAG_LEN = 16;

  constructor() {
    // Aceita ENCRYPTION_KEY (canônico) ou CRED_ENCRYPTION_KEY (alias compat)
    const masterKey = (process.env.ENCRYPTION_KEY || process.env.CRED_ENCRYPTION_KEY || '').trim();

    // Detecta placeholder do template do .env — não considera "configurado"
    const isPlaceholder =
      !masterKey ||
      masterKey.startsWith('change_me') ||
      masterKey.startsWith('CHANGE_ME');

    if (isPlaceholder) {
      this.key = null;
      this.enabled = false;
      this.logger.warn('ENCRYPTION_KEY não configurada (vazia ou placeholder) — credenciais ficam em texto puro. Configure em prod!');
      return;
    }

    // Aceita hex (64 chars = 32 bytes) ou base64 (44 chars com padding)
    let buf: Buffer;
    if (/^[0-9a-fA-F]{64}$/.test(masterKey)) {
      buf = Buffer.from(masterKey, 'hex');
    } else {
      buf = Buffer.from(masterKey, 'base64');
    }
    if (buf.length !== 32) {
      this.logger.error(`ENCRYPTION_KEY tem tamanho inválido (${buf.length} bytes, esperado 32). Encryption desabilitada.`);
      this.key = null;
      this.enabled = false;
      return;
    }

    this.key = buf;
    this.enabled = true;
    this.logger.log('CredentialEncryptor pronto (AES-256-GCM)');
  }

  /**
   * Encripta um valor. Idempotente — se já estiver no formato `enc:v1:...`,
   * retorna sem mudar (evita duplicar encriptação em update parcial).
   */
  encrypt(plain: string | null | undefined): string | null | undefined {
    if (plain === null || plain === undefined || plain === '') return plain;
    if (!this.enabled || !this.key) return plain;
    if (plain.startsWith(CredentialEncryptor.PREFIX)) return plain;

    const iv = crypto.randomBytes(CredentialEncryptor.IV_LEN);
    const cipher = crypto.createCipheriv(CredentialEncryptor.ALG, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, ciphertext]).toString('base64');
    return CredentialEncryptor.PREFIX + payload;
  }

  /**
   * Decripta um valor. Se vier sem prefixo `enc:v1:`, considera legado em
   * texto puro e devolve sem alterar — permite ler dados antigos do banco
   * sem quebrar (migração lazy).
   */
  decrypt(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    if (!this.enabled || !this.key) return value;
    if (!value.startsWith(CredentialEncryptor.PREFIX)) return value;

    try {
      const data = Buffer.from(value.slice(CredentialEncryptor.PREFIX.length), 'base64');
      const iv = data.subarray(0, CredentialEncryptor.IV_LEN);
      const tag = data.subarray(CredentialEncryptor.IV_LEN, CredentialEncryptor.IV_LEN + CredentialEncryptor.TAG_LEN);
      const ciphertext = data.subarray(CredentialEncryptor.IV_LEN + CredentialEncryptor.TAG_LEN);

      const decipher = crypto.createDecipheriv(CredentialEncryptor.ALG, this.key, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plain.toString('utf8');
    } catch (e: any) {
      // Se a chave master mudou, decrypt falha. Não vazamos dado, devolvemos
      // string vazia + log — o user vai precisar re-cadastrar a credencial.
      this.logger.error(`Falha ao decriptar credencial (chave master mudou?): ${e.message}`);
      return '';
    }
  }

  /** Mascara um valor pra exibição na UI: "abcd***wxyz". */
  mask(plain: string | null | undefined): string {
    if (!plain) return '';
    if (plain.length <= 8) return '*'.repeat(plain.length);
    return plain.slice(0, 4) + '*'.repeat(plain.length - 8) + plain.slice(-4);
  }
}
