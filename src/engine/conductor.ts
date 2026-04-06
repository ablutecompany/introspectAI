import type { InternalState } from '../types/internalState';
import type { LLMNextMoveType } from '../../shared/contracts/interviewContract';
import type { UserIntent } from './classifyInput';

export class ConductorEngine {
  static decideNextMove(
    state: InternalState, 
    userIntent: UserIntent
  ): LLMNextMoveType {
    
    // 1. Friction & Deflection Handlers
    if (userIntent === 'dont_know' || userIntent === 'vague') {
      if (state.consecutiveVagueAnswers > 0) {
        return 'ask_concrete_example';
      }
      return 'simplify';
    }

    if (userIntent === 'deflective') {
      return 'recenter';
    }

    // 2. Phase-Based Progression
    if (state.phase === 'opening' || state.phase === 'micro_triage') {
      return 'ask_open';
    }

    if (state.phase === 'guided_exploration') {
      // FORCE structural bridging for the first post-onboarding questions
      // The Onboarding itself is turnIndex 1. So turns 2 and 3 should be deeply structural!
      if (state.turnIndex === 1) return 'ask_concrete_example'; // First reply after onboarding MUST ground the abstract feelings
      if (state.turnIndex === 2) return 'ask_cost'; // Second reply must evaluate impact
      if (state.turnIndex === 3) return 'ask_fear'; // Third reply goes into the specific blockages
      
      // Fallbacks if we still lack dimensions after turn 3
      if (state.costSignals.length === 0) return 'ask_cost';
      if (state.fearSignals.length === 0) return 'ask_fear';
      if (state.desiredLifeSignals.length === 0) return 'ask_desired_life';
      return 'ask_open';
    }

    if (state.phase === 'deepening' || state.phase === 'contrast') {
      if (state.rivalHypotheses.length > 0 && !state.testedContrasts.length) return 'contrast';
      return 'ask_concrete_example';
    }

    // 3. Closure
    if (state.phase === 'closure_ready') {
      return 'deliver_outcome';
    }

    return 'ask_open';
  }
}
