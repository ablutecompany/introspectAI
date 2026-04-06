import type { InternalState } from '../types/internalState';
import type { UserIntent } from './classifyInput';
import type { LLMInterviewResponse } from '../../shared/contracts/interviewContract';

export class StateUpdater {
  static enrich(
    currentState: InternalState, 
    intent: UserIntent, 
    llmResponse: LLMInterviewResponse
  ): Partial<InternalState> {
    
    let updates: Partial<InternalState> = {};
    const sig = llmResponse.extractedSignals;
    
    // 1. Friction Tracking
    if (intent === 'dont_know' || intent === 'vague') {
      updates.consecutiveVagueAnswers = currentState.consecutiveVagueAnswers + 1;
    } else {
      updates.consecutiveVagueAnswers = 0;
    }
    
    if (intent === 'deflective') {
      updates.consecutiveDeflectiveAnswers = currentState.consecutiveDeflectiveAnswers + 1;
    } else {
      updates.consecutiveDeflectiveAnswers = 0;
    }

    // 2. Accumulate Signals
    const uniqueAppend = (existing: string[], news: string[] = []) => Array.from(new Set([...existing, ...news]));
    
    const nextCosts = uniqueAppend(currentState.costSignals, sig.costs);
    const nextFears = uniqueAppend(currentState.fearSignals, sig.fears);
    const nextMechanisms = uniqueAppend(currentState.mechanismSignals, sig.mechanisms);

    updates.contextSignals = uniqueAppend(currentState.contextSignals, sig.contexts);
    updates.costSignals = nextCosts;
    updates.fearSignals = nextFears;
    updates.mechanismSignals = nextMechanisms;
    
    // 3. Hypothesis
    if (llmResponse.suggestedUpdates.dominantHypothesis) {
      if (!currentState.dominantHypothesis) {
        updates.dominantHypothesis = llmResponse.suggestedUpdates.dominantHypothesis;
      } else if (currentState.dominantHypothesis !== llmResponse.suggestedUpdates.dominantHypothesis) {
        updates.secondaryHypothesis = currentState.dominantHypothesis;
        updates.dominantHypothesis = llmResponse.suggestedUpdates.dominantHypothesis;
      }
    }

    // 4. Update Confidence and Phase Evolution
    updates.confidenceLevel = llmResponse.suggestedUpdates.confidenceHint;
    
    const turn = currentState.turnIndex + 1;
    let currentPhase = currentState.phase;

    if (turn >= 2 && currentPhase === 'micro_triage') {
        currentPhase = 'guided_exploration';
    } else if (turn >= 6 && currentPhase === 'guided_exploration') {
        currentPhase = 'deepening';
    }

    const hasEnoughDimensions = nextCosts.length > 0 && nextMechanisms.length > 0;

    if (updates.confidenceLevel === 'strong' && hasEnoughDimensions && turn > 4) {
       currentPhase = 'closure_ready';
    }

    updates.phase = currentPhase;
    
    // Prepare Score Candidate
    const readiness = (nextCosts.length ? 1 : 0) + (nextFears.length ? 1 : 0) + (nextMechanisms.length ? 1 : 0);
    updates.outcomeReadinessScore = readiness;
    
    return updates;
  }
}
