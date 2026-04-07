import type { InternalState } from '../types/internalState';
import type { LLMNextMoveType } from '../../shared/contracts/interviewContract';
import type { UserIntent } from './classifyInput';

export class ConductorEngine {
  static decideNextMove(
    state: InternalState, 
    userIntent: UserIntent
  ): LLMNextMoveType {
    
    // 1. Meta-conversation & Friction Handlers
    if (userIntent === 'meta_conversation') {
      // Must recognize loop and stop interviewing.
      // E.g. "Tens razão. Estou a insistir onde já havia material..."
      return 'recenter'; 
    }

    if (userIntent === 'dont_know' || userIntent === 'vague') {
      return 'simplify';
    }

    if (userIntent === 'deflective') {
      return 'recenter';
    }

    // 2. Engine Flow (Pseudo-Logic implementation)
    switch (state.phase) {
      case 'SESSION_INIT':
        if (state.sessionMeta.isRegisteredUser && state.governance.sessionNovelty === 'recurring') {
          return 'ask_resume_preference'; // Transition to RESUME_CHECK
        }
        return 'ask_field';

      case 'RESUME_CHECK':
        return 'ask_continuation_mode';

      case 'FIELD':
        return 'ask_nature';

      case 'NATURE':
        return 'ask_function';

      case 'FUNCTION':
        return 'ask_cost';

      case 'COST':
        return 'ask_contrast';

      case 'CONTRAST':
        return 'ask_refinement'; 

      case 'DECIDE_NEXT':
        const { caseStructure, governance, sessionMeta } = state;
        const sufficientCaseStructure = 
          Boolean(caseStructure.caseField) && 
          Boolean(caseStructure.surfaceNature) && 
          Boolean(caseStructure.primaryFunction) && 
          Boolean(caseStructure.mainCost);

        if (sufficientCaseStructure) {
          return 'deliver_latent_reading';
        } else {
          // Extension triggers based on budget/fatigue
          if (governance.fatigueSignals.length > 0 || sessionMeta.questionCount >= 6) {
            return 'ask_extension_permission';
          } else {
            return 'ask_refinement';
          }
        }

      case 'EXTENSION_CHECK':
        if (state.governance.permissionToExtend === 'yes') {
          return 'ask_refinement';
        } else {
          return 'deliver_latent_reading';
        }

      case 'LATENT_READING':
        return 'deliver_guidance';

      case 'GUIDANCE':
        return 'deliver_close';

      case 'CONTINUATION_MODE_SELECT':
        if (state.continuityMemory.preferredMode === 'resume' || state.continuityMemory.preferredMode === 'reopen') {
          return 'ask_refinement'; // CONTINUED_CLARIFICATION
        }
        return 'deliver_guidance'; // CONTINUED_GUIDANCE

      case 'CONTINUED_CLARIFICATION':
        return 'deliver_latent_reading';

      case 'CONTINUED_GUIDANCE':
        return 'deliver_close';

      case 'CLOSE':
        return 'deliver_close';

      default:
        return 'ask_refinement';
    }
  }
}
