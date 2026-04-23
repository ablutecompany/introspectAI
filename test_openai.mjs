import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: 'fake-key' });
console.log('Keys on openai:', Object.keys(openai));
console.log('typeof openai.chat:', typeof openai.chat);
