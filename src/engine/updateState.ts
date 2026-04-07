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

    // 1. Merge Case Structure (incremental — nunca sobrescreve com null)
    const cs = llmResponse.extractedCaseStructure;
    if (cs) {
      updates.caseStructure = {
        ...currentState.caseStructure,
        ...(cs.caseField          ? { caseField: cs.caseField }               : {}),
        ...(cs.surfaceTheme       ? { surfaceTheme: cs.surfaceTheme }         : {}),
        ...(cs.surfaceNature      ? { surfaceNature: cs.surfaceNature }       : {}),
        ...(cs.primaryFunction    ? { primaryFunction: cs.primaryFunction }   : {}),
        ...(cs.mainCost           ? { mainCost: cs.mainCost }                 : {}),
        ...(cs.contrastResolution ? { contrastResolution: cs.contrastResolution } : {}),
        openAmbiguities: [
          ...currentState.caseStructure.openAmbiguities,
          ...(cs.openAmbiguities || [])
        ]
      };
    }

    // 2. Merge Latent Model
    const lm = llmResponse.extractedLatentModel;
    if (lm) {
      updates.latentModel = {
        ...currentState.latentModel,
        ...(lm.deeperTheme      ? { deeperTheme: lm.deeperTheme }           : {}),
        ...(lm.latentHypothesis ? { latentHypothesis: lm.latentHypothesis } : {}),
        ...(lm.centralTension   ? { centralTension: lm.centralTension }     : {}),
        ...(lm.maintenanceLoop  ? { maintenanceLoop: lm.maintenanceLoop }   : {}),
        ...(lm.hiddenCost       ? { hiddenCost: lm.hiddenCost }             : {}),
        ...(lm.confidenceLevel  ? { confidenceLevel: lm.confidenceLevel }   : {})
      };
    }

    // 3. Merge Guidance Model
    const gm = llmResponse.extractedGuidance;
    if (gm) {
      updates.guidanceModel = {
        ...currentState.guidanceModel,
        ...(gm.repositioningFrame     ? { repositioningFrame: gm.repositioningFrame }         : {}),
        ...(gm.keyDistinction         ? { keyDistinction: gm.keyDistinction }                 : {}),
        ...(gm.prematureActionToAvoid ? { prematureActionToAvoid: gm.prematureActionToAvoid } : {}),
        ...(gm.microStep              ? { microStep: gm.microStep }                           : {}),
        ...(gm.nextQuestionIfNeeded   ? { nextQuestionIfNeeded: gm.nextQuestionIfNeeded }     : {})
      };
    }

    // 4. Update Governance signals (meta-conversation, fatigue)
    const gov = llmResponse.detectedGovernanceSignals;
    if (gov || intent === 'meta_conversation') {
      updates.governance = {
        ...currentState.governance,
        metaConversationDetected:
          intent === 'meta_conversation' ||
          (gov?.metaConversationDetected ?? currentState.governance.metaConversationDetected),
        fatigueSignals: [
          ...currentState.governance.fatigueSignals,
          ...(gov?.fatigueSignals || [])
        ],
        extensionCount: currentState.governance.extensionCount
      };
    }

    // 5. Phase progression: map LLM next-move to session phase
    const move = llmResponse.nextMoveType;

    const moveToPhase: Partial<Record<typeof move, InternalState['phase']>> = {
      ask_field:                'FIELD',
      ask_nature:               'NATURE',
      ask_function:             'FUNCTION',
      ask_cost:                 'COST',
      ask_contrast:             'CONTRAST',
      ask_refinement:           'DECIDE_NEXT',
      ask_extension_permission: 'EXTENSION_CHECK',
      deliver_latent_reading:   'LATENT_READING',
      deliver_guidance:         'GUIDANCE',
      deliver_close:            'CLOSE',
      ask_resume_preference:    'RESUME_CHECK',
      ask_continuation_mode:    'CONTINUATION_MODE_SELECT',
      recenter:                 currentState.phase,
      simplify:                 currentState.phase
    };

    const nextPhase = moveToPhase[move] ?? currentState.phase;
    updates.phase = nextPhase;

    // Mark value delivered once we reach latent reading or beyond
    if (nextPhase === 'LATENT_READING' || nextPhase === 'GUIDANCE' || nextPhase === 'CLOSE') {
      updates.governance = {
        ...(updates.governance ?? currentState.governance),
        valueDeliveredYet: true
      };
    }

    return updates;
  }
}
