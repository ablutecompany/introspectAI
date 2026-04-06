import type { AskLLMRequest, LLMInterviewResponse } from '../../shared/contracts/interviewContract';
import { PromptBuilder } from './promptBuilder';
import { ProviderAdapter } from './providerAdapter';
import { LLMGuard } from './guards';

export async function askLLM(request: AskLLMRequest & { _requestId?: string }): Promise<LLMInterviewResponse> {
  const startTime = Date.now();
  const reqId = request._requestId || 'no-id';
  console.log(`[LLM Client] ID: ${reqId} | Entered askLLM execution.`);
  
  // 1. Conductor mandates next move
  const forcedMove = request.forcedNextMove || 'ask_open';
  
  // 2. Build explicit locked prompt
  const { system, user } = PromptBuilder.build(request.internalState, request.userResponse, forcedMove);
  console.log(`[LLM Client] ID: ${reqId} | Prompts built via Conductor.`);
  
  // 3. Ask provider
  let rawText = '';
  let activeProviderMode: 'live' | 'mock' = 'mock';
  try {
     console.log(`[LLM Client] ID: ${reqId} | Sending structured prompt to ProviderLayer...`);
     const res = await ProviderAdapter.requestOpenAI(system, user, reqId);
     rawText = res.content;
     activeProviderMode = res.providerMode;
     console.log(`[LLM Client] ID: ${reqId} | Provider Adapter returned successfully. Content Length: ${rawText.length}`);
  } catch (e: any) {
     console.error(`[LLM Client] ID: ${reqId} | ProviderAdapter Throw! Error:`, e);
     rawText = `{"error": "API Unreachable", "details": "${e.message}"}`; // Generates a Zod fail purposely if no catch configured
     activeProviderMode = 'live'; // Fails contextually inside live attempt
  }

  const latency = Date.now() - startTime;

  // 4. Validate through Zod constraints and apply Schema/Fallback overrides
  const finalResponse = LLMGuard.validate(rawText, forcedMove, {
     sessionId: request.internalState.sessionId,
     turnIndex: request.internalState.turnIndex,
     phase: request.internalState.phase,
     latency,
     inputType: request.inputType || 'typed',
     providerMode: activeProviderMode
  });

  return finalResponse;
}
