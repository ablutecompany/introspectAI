import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConversationTurnEngine } from '../server/conversation/conversationTurnEngine.js';
import type { ConversationTurnRequest } from '../src/shared/contracts/conversationTurnContract.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log("[API] Handler iniciado.");
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[API] Erro: OPENAI_API_KEY não configurada no ambiente.");
    return res.status(500).json({ error: 'Configuração em falta: OPENAI_API_KEY não encontrada.' });
  }

  // Log mascarado para auditoria segura
  const maskedKey = apiKey.substring(0, 7) + "..." + apiKey.substring(apiKey.length - 4);
  console.log(`[API] Handler iniciado com KEY: ${maskedKey}`);

  try {
    const startTime = Date.now();
    const payload = req.body as ConversationTurnRequest;
    console.log(`[API] Payload recebido: Stage=${payload.sessionStage}`);
    
    const engine = new ConversationTurnEngine(apiKey);
    const result = await engine.processTurn(payload);
    
    const duration = Date.now() - startTime;
    console.log(`[API] Sucesso em ${duration}ms`);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[API] Erro crítico no processamento:", error);
    return res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      details: error.toString()
    });
  }
}
