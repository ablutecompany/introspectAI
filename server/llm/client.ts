import type { AskLLMRequest, LLMInterviewResponse } from '../../shared/contracts/interviewContract.js';
import { PromptBuilder } from './promptBuilder.js';
import { ProviderAdapter } from './providerAdapter.js';
import { LLMGuard } from './guards.js';

export async function askLLM(request: AskLLMRequest & { _requestId?: string }): Promise<LLMInterviewResponse> {
  const startTime = Date.now();
  const reqId = request._requestId || 'no-id';
  console.log(`[LLM Client] ID: ${reqId} | Entered askLLM execution.`);

  // 1. Conductor mandates next move
  const forcedMove = request.forcedNextMove || 'ask_field';

  // 2. Build explicit locked prompt (phase-aware, includes blacklist and context)
  const { system, user } = PromptBuilder.build(request.internalState, request.userResponse, forcedMove);
  console.log(`[LLM Client] ID: ${reqId} | Prompts built via PromptBuilder.`);

  // 3. Ask provider
  console.log(`[LLM Client] ID: ${reqId} | Sending structured prompt to ProviderLayer...`);
  const res = await ProviderAdapter.requestOpenAI(system, user, reqId);
  const rawText = res.content;
  const activeProviderMode = res.providerMode;
  console.log(`[LLM Client] ID: ${reqId} | Provider Adapter returned. Content Length: ${rawText.length}`);

  const latency = Date.now() - startTime;

  // 4. Validate through Zod + Fallback overrides (Conductor Supremacy enforced inside LLMGuard)
  const state = request.internalState;
  const finalResponse = LLMGuard.validate(rawText, forcedMove, {
    sessionId: state.sessionMeta?.sessionId ?? 'unknown',
    turnCount: state.sessionMeta?.turnCount ?? 0,
    phase: state.phase,
    latency,
    inputType: request.inputType || 'typed',
    providerMode: activeProviderMode
  });

  return finalResponse;
}
