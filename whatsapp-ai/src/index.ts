import express from 'express';
import dotenv from 'dotenv';
import { AiAgent } from './agent/ai-agent.js';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3005;
const ERP_API_URL = process.env.ERP_API_URL || 'http://localhost:3000/api';

// Singleton agent cache — keyed by apiKey+model+tokens+erpUrl so config changes take effect immediately
const agentCache = new Map<string, AiAgent>();
function getAgent(apiKey: string, geminiModel: string, maxTokens: number): AiAgent {
  const cacheKey = `${apiKey}|${geminiModel}|${maxTokens}|${ERP_API_URL}`;
  if (!agentCache.has(cacheKey)) {
    agentCache.set(cacheKey, new AiAgent(apiKey, geminiModel, maxTokens, ERP_API_URL));
  }
  return agentCache.get(cacheKey)!;
}

app.get('/', (req, res) => res.send('GestorPrint WhatsApp AI Agent is running! 🤖'));

// Webhook for Evolution API
app.post('/webhook/whatsapp', async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'messages.upsert' && !data.key.fromMe) {
    const contact = data.key.remoteJid;
    const message = data.message;
    
    let text = message?.conversation || message?.extendedTextMessage?.text;
    console.log(`\n[📩 MSG RECEBIDA] De: ${contact}`);
    if (text) console.log(`   Conteúdo: "${text}"`);
    
    let mediaData: any = null;

    // Detect Media (Image or Document)
    const mediaType = message?.imageMessage ? 'image' : (message?.documentMessage ? 'document' : null);
    
    if (mediaType) {
      console.log(`Media received from ${contact}: ${mediaType}`);
    }

    if (!text && !mediaType) return res.sendStatus(200);

    try {
      // 1. Fetch AI Config from ERP
      const configRes = await axios.get(`${ERP_API_URL}/mcp/config`);
      const config: any = configRes.data;

      if (!config || !config.enabled || !config.geminiKey) {
        console.log(`   ⚠️ IA ignorada: ${!config ? 'Config nula' : (!config.enabled ? 'Agente Inativo' : 'Falta Gemini Key')}`);
        return res.sendStatus(200);
      }
      console.log(`   ✅ Configuração carregada (Agente: ${config.enabled ? 'ON' : 'OFF'})`);

      // 2. Handle Media Download if allowed
      const aiConfig = config as any;
      if (mediaType && aiConfig.allowFileUploads) {
        try {
          let downloadData: any = null;
          
          // Evolution API Media Download
          try {
            // Need to pass the full data object (key + message) for Evolution to find the media
            const downloadRes = await axios.post(`${aiConfig.evolutionUrl}/chat/getBase64FromMediaMessage/${aiConfig.evolutionInstance}`, {
              message: data
            }, {
              headers: { 'apikey': aiConfig.evolutionKey }
            });
            downloadData = downloadRes.data;
          } catch(e) {
            console.log("getBase64 request failed:", e);
          }

          if (downloadData && downloadData.base64) {
             let base64String = downloadData.base64;

             if (base64String) {
               mediaData = {
                 base64: base64String.includes(';') ? base64String.split(',')[1] : base64String,
                 filename: message[`${mediaType}Message`]?.fileName || `upload-${Date.now()}.${mediaType === 'image' ? 'jpg' : 'pdf'}`,
                 mimetype: message[`${mediaType}Message`]?.mimetype || (mediaType === 'image' ? 'image/jpeg' : 'application/pdf')
               };
               
               const mediaPrompt = `\n[SISTEMA: O usuário enviou um arquivo ${mediaType} chamado "${mediaData.filename}". Informe ao usuário que você recebeu a arte ou documento, e que se houver um pedido/orçamento em andamento você pode usar a ferramenta upload_artwork para anexá-lo.]`;
               text = (text || "") + mediaPrompt;
               console.log(`   📎 Mídia processada: ${mediaData.filename} (${mediaData.mimetype})`);
             }
          }
        } catch (err: any) {
          console.error("Error downloading media:", err.message);
        }
      }

      if (!text) return res.sendStatus(200);

      // 3. Get or create singleton agent (preserves chat history across messages)
      const agent = getAgent(config.geminiKey, config.geminiModel || 'gemini-2.0-flash', config.maxTokens || 1000);
      
      // 4. Process with AI
      const response = await agent.processMessage(contact, text, config.agentPrompt, mediaData);
      console.log(`   🤖 IA Respondeu: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`);

      // 4. Respond via Evolution API
      await axios.post(`${config.evolutionUrl}/message/sendText/${config.evolutionInstance}`, {
        number: contact.split('@')[0],
        text: response,
        delay: 1200,
        linkPreview: true
      }, {
        headers: { 'apikey': config.evolutionKey }
      });
      console.log(`   📤 Resposta enviada para o WhatsApp com sucesso!\n`);

    } catch (error: any) {
      console.error('Webhook processing error:', error.message);
      if (error.response?.data) {
        console.error('Evolution API Details:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 AI Agent server listening on port ${PORT}`);
});
