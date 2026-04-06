export type InternalStatePhase =
  | 'opening'
  | 'micro_triage'
  | 'guided_exploration'
  | 'deepening'
  | 'contrast'
  | 'closure_ready'
  | 'outcome_delivered';

export type IntensityLevel = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'insufficient' | 'moderate' | 'strong';

export interface InternalState {
  sessionId: string;
  mode: 'conversation' | 'writing';
  phase: InternalStatePhase;
  turnIndex: number;

  // Hipóteses
  dominantHypothesis: string | null;
  secondaryHypothesis: string | null;
  rivalHypotheses: string[];

  // Mapas de sinais
  axisSignals: string[];
  contextSignals: string[];
  mechanismSignals: string[];
  costSignals: string[];
  fearSignals: string[];
  desiredLifeSignals: string[];
  protectiveSignals: string[];

  // Clarificação
  unresolvedQuestions: string[];
  testedContrasts: string[];
  pendingClarifications: string[];

  // Fricção
  needsSimplification: boolean;
  needsRecentering: boolean;
  needsExample: boolean;
  needsContrasting: boolean;
  fatigueLevel: IntensityLevel;
  trustLevel: IntensityLevel;
  consecutiveVagueAnswers: number;
  consecutiveDeflectiveAnswers: number;

  // Ação
  actionableLevers: string[];
  blockedLevers: string[];

  // Fecho
  confidenceLevel: ConfidenceLevel;
  outcomeReadinessScore: number;
  outcomeLevelCandidate: 0 | 1 | 2 | 3 | null;

  // Memória operacional
  askedQuestionIds: string[];
  usedReframes: string[];
  collectedExamples: string[];
  keyUserPhrases: string[];
}
