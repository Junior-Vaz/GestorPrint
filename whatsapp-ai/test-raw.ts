import axios from 'axios';

async function run() {
  try {
    const configRes = await axios.get('http://localhost:3000/api/mcp/config');
    const key = configRes.data.geminiKey.trim();
    
    console.log('Testing Raw HTTP Request with key:', key.substring(0, 10) + '...');
    const url = https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key= + key;
    const body = {
      contents: [{ parts: [{ text: "Oi" }] }]
    };
    const res = await axios.post(url, body);
    console.log('Success!', res.data.candidates[0].content.parts[0].text);
  } catch(e: any) {
    console.log('Error Raw HTTP:');
    if(e.response && e.response.data) {
      console.log(JSON.stringify(e.response.data, null, 2));
    } else {
      console.log(e.message);
    }
  }
}
run();
