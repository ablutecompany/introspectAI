import type { AskLLMRequest, LLMInterviewResponse } from '../../shared/contracts/interviewContract';

export async function askLLM(request: AskLLMRequest): Promise<LLMInterviewResponse> {
  // In a real implementation, we would construct a prompt with `request.internalState` 
  // and send it via OpenAI/Anthropic API, validating the JSON response via zod logic.
  
  console.log(`[LLM MOCK] Received request, move logic focus: ${request.forcedNextMove}`);
  
  // Fake response for the MVP wiring
  return {
    nextMoveType: request.forcedNextMove || 'ask_open',
    userFacingText: "Isto é uma resposta gerada simulada. Percebo o que dizes. Para não nos perdermos: isto pesa-te mais como falta de margem ou como cansaço?",
    extractedSignals: {
        contexts: ['cansaço percecionado']
    },
    suggestedUpdates: {
        confidenceHint: 'moderate'
    }
  };
}
