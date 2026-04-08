export type InternalStatePhase =
  | 'TRIAGE'
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
  | 'CONTINUED_GUIDANCE'
  | 'LATENT_READING_DISPLAY'
  | 'CONTINUATION_ACTIVE'
  | 'CLOSE_NOW';

// ─── Triage Types ─────────────────────────────────────────────────────────────

/** The 6 primary friction areas + G (mixed) */
export type FrictionArea = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/** Subtype codes as defined in the spec (e.g. 'A1', 'B3', 'C5') */
export type TriageSubtype = string;

/** Where the friction is impacting daily life */
export type FunctionalImpact = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** What the user most needs to change first */
export type ImmediateGoal = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** Whether the user gave a concrete subtype or stayed diffuse/reserved */
export type DetailLevel = 'specific' | 'reserved_diffuse';

export interface TriageState {
  /** Which decision path was taken */
  path: 'normal' | 'mixed';
  /** Primary friction area (A–F; never G in final output) */
  primary_problem_area: Exclude<FrictionArea, 'G'>;
  /** Subtype code within primary area, e.g. 'C2'. Null if not specified. */
  primary_problem_subtype: TriageSubtype | null;
  /** Secondary area — mandatory in mixed path, null in normal path */
  secondary_problem_area: Exclude<FrictionArea, 'G'> | null;
  /** Impact domain; optional in mixed path first version */
  functional_impact_area: FunctionalImpact | null;
  /** The most desired immediate change */
  immediate_goal: ImmediateGoal;
  /** Whether the user gave specific or diffuse answers */
  detail_level: DetailLevel;
  /** Timestamp when triage was completed */
  completedAt: number;
}

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
  
  // V1 additions:
  extensionOffered: boolean;
  extensionAccepted: boolean | null;
  shouldStopInterviewing: boolean;
  shouldAskExtension: boolean;
  shouldCloseNow: boolean;
  budgetProfile: 'first_session_short' | 'recurring_normal';
  lastGovernanceReason: string | null;
}

// ─── Post-Triage Continuation ──────────────────────────────────────────────────

export type ContinuationMode = 'refine_understanding' | 'test_hypothesis' | 'work_from_reading' | 'close_now';

export interface ContinuationOutput {
  title: string;
  mainText: string;
  optionalPrompt?: string;
  closingText?: string;
}

export interface ContinuationState {
  mode: ContinuationMode | null;
  reason: string | null;
  expectedValue: string | null;
  maxTurnsInMode: number;
  turnsUsedInMode: number;
  continuationResolved: boolean;
  failureFlags: string[];
  shouldCloseAfterThisTurn: boolean;
  outputPayload?: ContinuationOutput;
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

  /** Triage output — null until triage is completed */
  triageState: TriageState | null;

  continuationState: ContinuationState;

  // Memória operacional mínima para manter retrocompatibilidade / histórico
  askedQuestionIds: string[];
  transcriptHistory: { role: 'human' | 'ai'; text: string }[];
}
