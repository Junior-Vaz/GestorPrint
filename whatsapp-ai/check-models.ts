import axios from 'axios';

async function run() {
  try {
    const configRes = await axios.get('http://localhost:3000/api/mcp/config');
    const key = configRes.data.geminiKey;
    console.log('API Key:', key.substring(0, 5) + '...');
    const url = https://generativelanguage.googleapis.com/v1beta/models?key= + key;
    const models = await axios.get(url);
    console.log('Available models:', models.data.models.map((m:any) => m.name).join(', '));
  } catch (e: any) {
    console.error('Error fetching models:', e.message);
    if (e.response && e.response.data) {
      console.error(JSON.stringify(e.response.data, null, 2));
    }
  }
}
run();
