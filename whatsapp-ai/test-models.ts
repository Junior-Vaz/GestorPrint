import axios from 'axios';

async function run() {
  try {
    const configRes = await axios.get('http://localhost:3000/api/mcp/config');
    const key = configRes.data.geminiKey.trim();
    console.log('Testing with key:', key.substring(0, 10) + '...');
    const res = await axios.get(https://generativelanguage.googleapis.com/v1beta/models?key= + key);
    console.log('Models available:', res.data.models.map(m => m.name).join(', '));
  } catch(e: any) {
    console.log('Error listing models:', e.message);
    if(e.response) {
      console.log('Error details:', JSON.stringify(e.response.data));
    }
  }
}
run();
