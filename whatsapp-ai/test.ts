import { AiAgent } from './src/agent/ai-agent.js';
import axios from 'axios';
import fs from 'fs';

async function run() {
  try {
    const configRes = await axios.get('http://localhost:3000/api/mcp/config');
    const config = configRes.data;
    const agent = new AiAgent(config.geminiKey);
    console.log('Testing AI Agent...');
    const response = await agent.processMessage('5511999999999@s.whatsapp.net', 'oi', config.agentPrompt);
    console.log('AI Response:', response);
  } catch (e: any) {
    fs.writeFileSync('error.log', JSON.stringify({ message: e.message, response: e.response?.data,  err: e }, null, 2));
  }
}
run();
