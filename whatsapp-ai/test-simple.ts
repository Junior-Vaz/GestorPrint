import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

async function run() {
  try {
    const configRes = await axios.get('http://localhost:3000/api/mcp/config');
    const key = configRes.data.geminiKey;
    const genAI = new GoogleGenerativeAI(key);
    
    console.log('Testing gemini-1.5-flash without tools...');
    const model1 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: 'hello' });
    const res1 = await model1.generateContent('hi');
    console.log('Success without tools:', res1.response.text().substring(0, 20));
  } catch(e: any) {
    console.log('Error without tools:', e.message);
  }
}
run();
