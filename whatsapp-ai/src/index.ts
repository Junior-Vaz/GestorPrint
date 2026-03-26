import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import { FlowEngine } from './engine/flow-engine.js';
import { AiConfig } from './types/flow.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3005;
const ERP_API_URL = process.env.ERP_API_URL || 'http://localhost:3000/api';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'gestorprint-internal-2026';

// Cache AI config per tenant to avoid fetching on every message
const configCache = new Map<number, { config: AiConfig; fetchedAt: number }>();
const CONFIG_TTL_MS = 10 * 1000; // 10 seconds (fast pickup of config changes)

async function getAiConfig(tenantId: number): Promise<AiConfig | null> {
  const cached = configCache.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < CONFIG_TTL_MS) {
    return cached.config;
  }
  try {
    const res = await axios.get(`${ERP_API_URL}/mcp/config-internal`, {
      headers: { 'x-internal-key': INTERNAL_KEY, 'x-tenant-id': String(tenantId) },
    });
    const cfg = res.data as AiConfig;
    cfg.tenantId = tenantId;
    configCache.set(tenantId, { config: cfg, fetchedAt: Date.now() });
    return cfg;
  } catch (e: any) {
    console.error('[CONFIG] Failed to load AI config:', e.message);
    return null;
  }
}

app.get('/', (_req, res) => {
  res.send('GestorPrint WhatsApp Flow Engine is running! 🤖');
});

// Preview endpoint — runs the real flow engine with a virtual phone session
app.post('/preview', async (req, res) => {
  const { tenantId = 1, sessionId, message = '', nodes, edges, reset } = req.body as any;
  const previewPhone = `preview-${sessionId || 'default'}`;

  if (reset) {
    const { deleteCachedSession } = await import('./engine/session-store.js');
    deleteCachedSession(tenantId, previewPhone);
    return res.json({ response: null });
  }

  const cfg = await getAiConfig(tenantId);
  if (!cfg || !cfg.geminiKey) {
    return res.json({ response: '⚠️ Configure a chave Gemini nas configurações da IA para usar o preview real.' });
  }

  try {
    const inlineConfig = nodes && edges ? { nodes, edges } : undefined;
    const engine = new FlowEngine(ERP_API_URL, cfg, inlineConfig);
    const response = await engine.processMessage(previewPhone, message);
    res.json({ response: response || null });
  } catch (e: any) {
    console.error('[PREVIEW]', e.message);
    res.json({ response: `Erro: ${e.message}` });
  }
});

// Webhook for Evolution API
app.post('/webhook/whatsapp', async (req, res) => {
  const { event, data } = req.body;

  if (event !== 'messages.upsert' || data?.key?.fromMe) {
    return res.sendStatus(200);
  }

  const contact: string = data.key?.remoteJid;
  const message = data.message;
  if (!contact || !message) return res.sendStatus(200);

  let text: string | undefined =
    message?.conversation || message?.extendedTextMessage?.text;

  const mediaType: 'image' | 'document' | null =
    message?.imageMessage ? 'image' : message?.documentMessage ? 'document' : null;

  console.log(`\n[📩 MSG] ${contact} | type=${mediaType || 'text'} | "${text?.substring(0, 60) || ''}"`);

  if (!text && !mediaType) return res.sendStatus(200);

  // Determine tenantId — for single-tenant setup use 1; multi-tenant would route by instance name
  // Evolution API sends the instance name in the webhook; we map it to a tenantId
  const tenantId: number = +(process.env.TENANT_ID || 1);

  try {
    // 1. Load AI config
    const cfg = await getAiConfig(tenantId);
    if (!cfg || !cfg.enabled || !cfg.geminiKey) {
      console.log('[CONFIG] AI disabled or missing key — skipping');
      return res.sendStatus(200);
    }

    // 2. Download media if present
    let mediaBase64: string | undefined;
    let mediaMime: string | undefined;

    if (mediaType && cfg.allowFileUploads) {
      try {
        const dlRes = await axios.post(
          `${cfg.evolutionUrl}/chat/getBase64FromMediaMessage/${cfg.evolutionInstance}`,
          { message: data },
          { headers: { apikey: cfg.evolutionKey } },
        );
        const dlData = dlRes.data as any;
        if (dlData?.base64) {
          let b64 = dlData.base64 as string;
          // Strip data URI prefix if present
          if (b64.includes(',')) b64 = b64.split(',')[1];
          mediaBase64 = b64;
          mediaMime = message[`${mediaType}Message`]?.mimetype ||
            (mediaType === 'image' ? 'image/jpeg' : 'application/pdf');
          console.log(`   📎 Media downloaded (${mediaMime})`);
        }
      } catch (e: any) {
        console.error('[MEDIA] Download failed:', e.message);
      }
    }

    if (!text && !mediaBase64) return res.sendStatus(200);

    // 3. Run flow engine
    const engine = new FlowEngine(ERP_API_URL, cfg);
    const responseText = await engine.processMessage(
      contact,
      text || '',
      mediaBase64,
      mediaMime,
    );

    if (!responseText) {
      console.log('   ⏭  Silent advance — no message to send');
      return res.sendStatus(200);
    }

    // 4. Send response via Evolution API
    await axios.post(
      `${cfg.evolutionUrl}/message/sendText/${cfg.evolutionInstance}`,
      {
        number: contact.split('@')[0],
        text: responseText,
        delay: 1200,
        linkPreview: false,
      },
      { headers: { apikey: cfg.evolutionKey } },
    );

    console.log(`   📤 Sent: "${responseText.substring(0, 80)}${responseText.length > 80 ? '...' : ''}"`);
  } catch (err: any) {
    console.error('[WEBHOOK] Error:', err.message);
    if (err.response?.data) {
      console.error('   Details:', JSON.stringify(err.response.data).substring(0, 200));
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Flow Engine listening on port ${PORT}`);
  console.log(`   ERP API: ${ERP_API_URL}`);
});
