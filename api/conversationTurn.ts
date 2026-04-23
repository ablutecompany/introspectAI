import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConversationTurnEngine } from '../server/conversation/conversationTurnEngine';
import type { ConversationTurnRequest } from '../src/shared/contracts/conversationTurnContract';

const engine = new ConversationTurnEngine();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body as ConversationTurnRequest;
    const result = await engine.processTurn(payload);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("ConversationTurn API Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
