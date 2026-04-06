import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    nextMoveType: 'ask_open',
    userFacingText: '[SMOKE TEST] A ligação com a Vercel funciona perfeitamente, o problema está na comunicação com a OpenAI ou parser!',
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'strong' }
  });
}
