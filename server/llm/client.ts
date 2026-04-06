import type { AskLLMRequest, LLMInterviewResponse } from '../../shared/contracts/interviewContract';
import { PromptBuilder } from './promptBuilder';
import { ProviderAdapter } from './providerAdapter';
import { LLMGuard } from './guards';

export async function askLLM(request: AskLLMRequest): Promise<LLMInterviewResponse> {
  const startTime = Date.now();
  
  // 1. Conductor mandates next move
  const forcedMove = request.forcedNextMove || 'ask_open';
  
  // 2. Build explicit locked prompt
  const { system, user } = PromptBuilder.build(request.internalState, request.userResponse, forcedMove);
  
  // 3. Ask provider
  let rawText = '';
  try {
     rawText = await ProviderAdapter.requestOpenAI(system, user);
  } catch (e: any) {
     rawText = `{"error": "API Unreachable", "details": "${e.message}"}`; // Generates a Zod fail purposely if no catch configured
  }

  const latency = Date.now() - startTime;

  // 4. Validate through Zod constraints and apply Schema/Fallback overrides
  const finalResponse = LLMGuard.validate(rawText, forcedMove, {
     sessionId: request.internalState.sessionId,
     turnIndex: request.internalState.turnIndex,
     phase: request.internalState.phase,
     latency
  });

  return finalResponse;
}
