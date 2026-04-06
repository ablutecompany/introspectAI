export type LLMNextMoveType =
  | 'ask_open'
  | 'ask_concrete_example'
  | 'ask_cost'
  | 'ask_fear'
  | 'ask_desired_life'
  | 'recenter'
  | 'simplify'
  | 'contrast'
  | 'deliver_outcome';

export interface LLMInterviewResponse {
  nextMoveType: LLMNextMoveType;
  userFacingText: string;
  extractedSignals: {
    contexts?: string[];
    costs?: string[];
    fears?: string[];
    mechanisms?: string[];
  };
  suggestedUpdates: {
    dominantHypothesis?: string;
    confidenceHint: 'insufficient' | 'moderate' | 'strong';
  };
}

export interface AskLLMRequest {
  internalState: any; // Mapped dynamically to InternalState on Backend
  userResponse: string;
  userIntent: 'vague' | 'deflective' | 'substantive' | 'dont_know' | 'simplify_request' | 'not_me_request';
  forcedNextMove?: LLMNextMoveType;
  inputType?: 'typed' | 'transcribed' | 'corrected_transcript';
}
