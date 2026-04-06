import { LLMInterviewResponseSchema } from './schemas.js';
import { FALLBACKS } from './fallbacks.js';
import type { LLMInterviewResponse, LLMNextMoveType } from '../../shared/contracts/interviewContract.js';
import { SessionLogger } from '../logging/sessionLogger.js';

export class LLMGuard {
  static validate(
    rawText: string, 
    requestedMove: LLMNextMoveType, 
    context: { sessionId: string; turnIndex: number; phase: string; latency: number, inputType: string, providerMode: 'live'|'mock' }
  ): LLMInterviewResponse {
    
    try {
      // 1. Try to parse JSON from the raw text (which might be wrapped in markdown or partial)
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedJson = JSON.parse(cleanedText);
      
      // 2. Validate against strict Zod Schema
      const validated = LLMInterviewResponseSchema.parse(parsedJson);

      // 3. ENFORCE CONDUCTOR SUPREMACY
      // If the LLM tries to be smart and change the next move type, we overwrite it.
      if (validated.nextMoveType !== requestedMove) {
          validated.nextMoveType = requestedMove;
      }

      SessionLogger.logAudit({
        timestamp: new Date().toISOString(),
        sessionId: context.sessionId,
        turnIndex: context.turnIndex,
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
      // 4. FALLBACK TRIGGERED
      SessionLogger.logAudit({
        timestamp: new Date().toISOString(),
        sessionId: context.sessionId,
        turnIndex: context.turnIndex,
        phase: context.phase,
        requestedMove,
        inputType: context.inputType,
        providerMode: context.providerMode,
        rawLLMResponse: rawText,
        fallbackTriggered: true,
        error: error?.message || 'JSON Parse Schema Mismatch',
        latencyMs: context.latency
      });

      return FALLBACKS[requestedMove];
    }
  }
}
