import { AiAgent } from './src/agent/ai-agent.ts';
import axios from 'axios';
import fs from 'fs';

async function run() {
  try {
    const configRes = await axios.get('http://localhost:3000/api/mcp/config');
    const config = configRes.data;
    const agent = new AiAgent(config.geminiKey);
    console.log('Testing File Upload with AI Agent...');
    
    // Create a tiny fake image base64
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const mediaData = {
      base64: base64Image,
      mimetype: 'image/png'
    };

    const text = 'Aqui esta a minha arte para os cartoes de visita';
    const response = await agent.processMessage('5511999999999@s.whatsapp.net', text, config.agentPrompt, mediaData);
    console.log('AI Response:', response);
  } catch (e: any) {
    console.error('Test script error:', e.message);
  }
}
run();
