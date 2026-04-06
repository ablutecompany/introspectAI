import type { VercelRequest, VercelResponse } from '@vercel/node';
import { askLLM } from '../server/llm/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    const response = await askLLM(payload);
    
    // Assegurar fallback de emergência também via status 200 para não estourar UI client parsing
    res.status(200).json(response);
  } catch (error: any) {
    console.error('[Vercel Serverless] AskLLM Falhou:', error);
    res.status(500).json({ error: error.message || 'Internal API Error' });
  }
}
