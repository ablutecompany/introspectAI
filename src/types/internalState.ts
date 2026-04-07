export type InternalStatePhase =
  | 'SESSION_INIT'
  | 'RESUME_CHECK'
  | 'FIELD'
  | 'NATURE'
  | 'FUNCTION'
  | 'COST'
  | 'CONTRAST'
  | 'DECIDE_NEXT'
  | 'LATENT_READING'
  | 'GUIDANCE'
  | 'EXTENSION_CHECK'
  | 'CLOSE'
  | 'FOLLOWUP_RESUME'
  | 'CONTINUATION_MODE_SELECT'
  | 'CONTINUED_CLARIFICATION'
  | 'CONTINUED_GUIDANCE';

export type IntensityLevel = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'insufficient' | 'moderate' | 'strong';
export type ContinuityMode = 'resume' | 'reopen' | 'work_from_previous' | null;

export interface SessionMeta {
  sessionId: string;
  userId?: string;
  isFirstSession: boolean;
  isRegisteredUser: boolean;
  startedAt: number;
  updatedAt: number;
  turnCount: number;
  questionCount: number;
  answerCount: number;
}

export interface GovernanceState {
  userToleranceLevel: IntensityLevel;
  conversationLoad: IntensityLevel;
  clarificationNeed: IntensityLevel;
  permissionToExtend: 'yes' | 'no' | 'not_asked';
  sessionNovelty: 'first' | 'recurring';
  fatigueSignals: string[];
  metaConversationDetected: boolean;
  valueDeliveredYet: boolean;
  extensionCount: number;
}

export interface CaseStructure {
  caseField: string | null;
  surfaceTheme: string | null;
  surfaceNature: string | null;
  primaryFunction: string | null;
  mainCost: string | null;
  contrastResolution: string | null;
  openAmbiguities: string[];
}

export interface LatentModel {
  deeperTheme: string | null;
  latentHypothesis: string | null;
  centralTension: string | null;
  maintenanceLoop: string | null;
  hiddenCost: string | null;
  confidenceLevel: ConfidenceLevel;
}

export interface GuidanceModel {
  repositioningFrame: string | null;
  keyDistinction: string | null;
  prematureActionToAvoid: string | null;
  microStep: string | null;
  nextQuestionIfNeeded: string | null;
}

export interface ContinuityMemory {
  priorCaseTheme: string | null;
  priorLatentHypothesis: string | null;
  priorPrimaryFunction: string | null;
  priorCentralTension: string | null;
  priorMainCost: string | null;
  priorOpenAmbiguities: string[];
  priorMicroStep: string | null;
  userResponseToLastStep: string | null;
  toleranceStyle: IntensityLevel | null;
  preferredDepth: IntensityLevel | null;
  preferredMode: ContinuityMode;
}

export interface InternalState {
  schemaVersion: number;
  appVersion: string;
  mode: 'conversation' | 'writing';
  phase: InternalStatePhase;

  sessionMeta: SessionMeta;
  governance: GovernanceState;
  caseStructure: CaseStructure;
  latentModel: LatentModel;
  guidanceModel: GuidanceModel;
  continuityMemory: ContinuityMemory;

  // Memória operacional mínima para manter retrocompatibilidade / histórico
  askedQuestionIds: string[];
  transcriptHistory: { role: 'human' | 'ai'; text: string }[];
}
