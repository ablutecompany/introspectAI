export type LLMNextMoveType =
  | 'ask_field'
  | 'ask_nature'
  | 'ask_function'
  | 'ask_cost'
  | 'ask_contrast'
  | 'ask_refinement'
  | 'deliver_latent_reading'
  | 'deliver_guidance'
  | 'ask_extension_permission'
  | 'deliver_close'
  | 'ask_resume_preference'
  | 'ask_continuation_mode'
  | 'recenter'
  | 'simplify';

export interface LLMInterviewResponse {
  nextMoveType: LLMNextMoveType;
  userFacingText: string;
  
  // Para Fases FIELD / NATURE / FUNCTION / COST / CONTRAST
  extractedCaseStructure?: {
    caseField?: string;
    surfaceTheme?: string;
    surfaceNature?: string;
    primaryFunction?: string;
    mainCost?: string;
    contrastResolution?: string;
    openAmbiguities?: string[];
  };

  // Para Fase LATENT_READING
  extractedLatentModel?: {
    deeperTheme?: string;
    latentHypothesis?: string;
    centralTension?: string;
    maintenanceLoop?: string;
    hiddenCost?: string;
    confidenceLevel?: 'insufficient' | 'moderate' | 'strong';
  };

  // Para Fase GUIDANCE
  extractedGuidance?: {
    repositioningFrame?: string;
    keyDistinction?: string;
    prematureActionToAvoid?: string;
    microStep?: string;
    nextQuestionIfNeeded?: string;
  };

  // Metadados de interação
  detectedGovernanceSignals?: {
    metaConversationDetected?: boolean;
    fatigueSignals?: string[];
  };
}

export interface AskLLMRequest {
  internalState: any; // Mapped dynamically to InternalState on Backend
  userResponse: string;
  userIntent: 'vague' | 'deflective' | 'substantive' | 'dont_know' | 'simplify_request' | 'not_me_request' | 'meta_conversation';
  forcedNextMove?: LLMNextMoveType;
  inputType?: 'typed' | 'transcribed' | 'corrected_transcript';
}
