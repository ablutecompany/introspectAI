import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ProviderAdapter } from '../server/llm/providerAdapter.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userVoice, validOptions, stepQuestion } = req.body;
    
    const sysPrompt = `You are a strict semantic classifier for a psychological onboarding flow.
The user was asked: "${stepQuestion}"
The user responded by voice: "${userVoice}"

You must map their response to one of the following EXACT valid options ONLY:
${validOptions.map((opt: string) => `- ${opt}`).join('\n')}

RULES:
- If the phrase means the same thing or expresses the core intent of an option, match it.
- If the user said something off-topic (e.g., "isto não funciona", "queria pedir uma piza"), a meta-commentary about the app, or something that absolutely does NOT map to any of the valid intents, you MUST return "NO_MATCH".

Respond in JSON with this schema EXACTLY:
{
   "matchedOptionId": "one of the exact strings from the valid options, or NO_MATCH",
   "confidence": "high, medium, or low",
   "reason": "short thought process"
}`;

    const llmRes = await ProviderAdapter.requestOpenAI(sysPrompt, "Classify the voice input now.", 1);
    
    let parsed;
    try {
        parsed = JSON.parse(llmRes.content);
    } catch(e) {
        parsed = { matchedOptionId: 'NO_MATCH', confidence: 'low', reason: 'parse error fallback' };
    }

    res.status(200).json(parsed);
  } catch (error: any) {
    console.error('[Vercel Serverless] Match LLM Falhou:', error);
    res.status(500).json({ error: error.message || 'Internal Match API Error' });
  }
}
