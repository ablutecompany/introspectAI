import type { VercelRequest, VercelResponse } from '@vercel/node';
import { askLLM } from '../server/llm/client';

export const maxDuration = 60; // Max Allowed Time on Vercel Hobby Tier for Serverless Functions

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const reqId = (req.headers['x-request-id'] || req.headers['x-vercel-id'] || 'no-id') as string;
  console.log(`[Backend API] Request ID: ${reqId} | Method: ${req.method} | Body Payload Valid: ${!!req.body}`);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    if (!payload || !payload.internalState) {
        console.error(`[Backend API] ID: ${reqId} | Invalid Payload received (missing internalState).`);
        return res.status(400).json({ error: "Missing valid internalState block in payload." });
    }
    
    // Inject the proxy requestId down to LLM client so logs sync perfectly
    payload._requestId = reqId;

    const response = await askLLM(payload);
    
    console.log(`[Backend API] ID: ${reqId} | Response generated successfully. Sending 200...`);
    // Assegurar fallback de emergência também via status 200 para não estourar UI client parsing
    res.status(200).json(response);
  } catch (error: any) {
    console.error(`[Vercel Serverless] ID: ${reqId} | AskLLM Falhou de forma terminal:`, error);
    res.status(500).json({ error: error.message || 'Internal API Error' });
  }
}
