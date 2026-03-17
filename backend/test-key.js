const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

async function check() {
  const prisma = new PrismaClient();
  try {
    const aiConfig = await prisma.aIConfig.findFirst();
    if (!aiConfig) {
      console.log('No AI config in DB');
      return;
    }
    const key = aiConfig.geminiKey;
    console.log('Key in DB starts with:', key.substring(0, 5));
    
    // Check models
    const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + key;
    const res = await axios.get(url);
    const models = res.data.models.map(m => m.name);
    console.log('Available models:', models.join(', '));
  } catch(e) {
    if(e.response) {
      console.log('Error from Google API:', e.response.status, JSON.stringify(e.response.data));
    } else {
      console.log('Error:', e.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}
check();
