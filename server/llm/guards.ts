import { LLMInterviewResponseSchema } from './schemas.js';
import { FALLBACKS } from './fallbacks.js';
import type { LLMInterviewResponse, LLMNextMoveType } from '../../shared/contracts/interviewContract.js';
import { SessionLogger } from '../logging/sessionLogger.js';

export class LLMGuard {
  static validate(
    rawText: string,
    requestedMove: LLMNextMoveType,
    context: { sessionId: string; turnCount: number; phase: string; latency: number; inputType: string; providerMode: 'live' | 'mock' }
  ): LLMInterviewResponse {

    try {
      // 1. Parse JSON — strip possible markdown fences
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedJson = JSON.parse(cleanedText);

      // 2. Validate against Zod schema
      const validated = LLMInterviewResponseSchema.parse(parsedJson);

      // 3. CONDUCTOR SUPREMACY — overwrite any LLM-chosen move to honour the Conductor
      if (validated.nextMoveType !== requestedMove) {
        validated.nextMoveType = requestedMove;
      }

      SessionLogger.logAudit({
        timestamp: new Date().toISOString(),
        sessionId: context.sessionId,
        turnIndex: context.turnCount,
        phase: context.phase,
        requestedMove,
        inputType: context.inputType,
        providerMode: context.providerMode,
        rawLLMResponse: cleanedText,
        validatedOutcome: JSON.stringify(validated),
        fallbackTriggered: false,
        latencyMs: context.latency
      });

      return validated as LLMInterviewResponse;

    } catch (error: any) {
      // 4. FALLBACK — log and return static safe response
      SessionLogger.logAudit({
        timestamp: new Date().toISOString(),
        sessionId: context.sessionId,
        turnIndex: context.turnCount,
        phase: context.phase,
        requestedMove,
        inputType: context.inputType,
        providerMode: context.providerMode,
        rawLLMResponse: rawText,
        fallbackTriggered: true,
        error: error?.message || 'JSON Parse / Schema Mismatch',
        latencyMs: context.latency
      });

      return FALLBACKS[requestedMove] ?? FALLBACKS['recenter'];
    }
  }
}
