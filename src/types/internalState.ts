export type InternalStatePhase =
  | 'TRIAGE'
  | 'LATENT_READING_DISPLAY'
  | 'CONTINUATION_ACTIVE'
  | 'CLOSE_NOW';

// ─── Sprint 6: Delta entre Sessões ─────────────────────────────────────────────

/**
 * Direção percebida da mudança entre sessões.
 * Classificada pelo deltaEngine com base nas respostas de follow-up.
 * Valor honesto: 'too_early' quando não há informação suficiente.
 */
export type ChangeDirection =
  | 'improved'     // melhorou — menos pressão, mais clareza
  | 'worsened'     // piorou — mais pressão, menos clareza
  | 'stable'       // manteve-se — padrão igual
  | 'shifted'      // mudou de natureza — não melhor nem pior, mas diferente
  | 'too_early';   // cedo demais para saber

/**
 * O que o sistema vai fazer com o caso após o follow-up.
 * Decidido pelo caseAdjustmentEngine com base no delta observado.
 *
 * Ponto de extensão: Sprint 7 usa isto para orientar o primeiro passo.
 */
export type WorkingDirection =
  | 'confirm'      // hipótese confirmada — aprofundar dentro do mesmo foco
  | 'correct'      // hipótese errada ou incompleta — redirecionar
  | 'deepen'       // hipótese válida mas falta função/tensão/custo
  | 'stabilize';   // mais clareza, menos variação — manter e consolidar

/**
 * Snapshot do delta calculado na reentrada atual.
 * Guardado no CaseMemory para reutilização em sessões futuras.
 */
export interface ProgressDelta {
  /** Direção da mudança observada nesta reentrada. */
  changeDirection: ChangeDirection;
  /** Confiança do motor nesta classificação (0–1). */
  changeConfidence: number;
  /** Linha humana sobre o que mudou (para mostrar na próxima ReentryGate). */
  changeSummaryLine: string | null;
  /** Timestamp quando este delta foi calculado. */
  calculatedAt: number;
}

/**
 * Inferência do motor sobre o que fazer a seguir com o caso.
 * Calculada no fim do follow-up com base no delta + memória existente.
 */
export interface FollowUpInference {
  /** O que fazer ao caso. */
  workingDirection: WorkingDirection;
  /** Razão interna (para log/debug — não exposta ao utilizador). */
  reason: string;
  /** Timestamp desta inferência. */
  inferredAt: number;
}

// ─── Longitudinal Architecture ──────────────────────────────────────────────────

export type SessionStage =
  | 'ENTRY_ORIENTATION'
  | 'PROVISIONAL_FOCUS'
  | 'DISCRIMINATIVE_EXPLORATION'
  | 'EMERGENT_READING'
  | 'READING_CHECKPOINT'    // Sprint 8: gate entre leitura emergente e orientação
  | 'WORK_ASSIGNMENT'
  | 'FOLLOW_UP_REENTRY'
  | 'CLOSE_NOW';



export interface CaseMemory {
  currentFocus: string | null;
  provisionalHypothesis: string | null;
  competingHypothesis: string | null;
  hiddenFunctionCandidate: string | null;
  invisibleCostCandidate: string | null;
  maintenanceErrorCandidate: string | null;
  hotLeads: string[];
  userIdiolect: string[];
  assignedWork: string | null;
  progressSignals: string[];
  confidenceState: 'insufficient' | 'moderate' | 'strong';
  followUpMeta: {
    lastSessionDate: number | null;
    pendingWorkAssigned: boolean;
  };

  // ─── Sprint 3: Registo de Discriminação ────────────────────────────────────────
  // Guarda o histórico de perguntas discriminadoras feitas ao utilizador
  // para evitar repetição disfarada e actualizar confiança com base nas respostas.
  discriminationRecord: DiscriminationEntry[];

  // ─── Sprint 6: Delta entre Sessões ─────────────────────────────────────────────
  /** Último snapshot de mudança calculado na reentrada. Null na primeira sessão. */
  lastProgressDelta: ProgressDelta | null;
  /** Inferência actual sobre o que fazer com o caso. Guia o fluxo pós-reentrada. */
  followUpInference: FollowUpInference | null;

// ─── Sprint 9: Estado de Clarificação e Repair Loop ────────────────────────────
  // Regista as intenções que já foram alvo de clarificação (intentTag -> attempts).
  // Permite limitar loops (ex: max 1 reformulação por tag).
  clarificationRecord: Record<string, number>;

  // ─── Sprint 10: Extração Semântica Leve ───────────────────────────────────────
  /** Último significado substantivo extraído da resposta do utilizador */
  lastExtractedMeaning: string | null;
  /** Fragmentos exatos de frases úteis que o utilizador usou */
  userPhrasingFragments: string[];
  /** Termos isolados fortes que podem ser usados para reflexo */
  salientTerms: string[];
  
  // ─── Sprint 10B: Sinais de Correção ──────────────────────────────────────────
  /** Último sinal de correção explícito submetido pelo utilizador */
  lastCorrectionSignal: string | null;
  /** Registo da última correção aplicada ao foco ou hipótese */
  correctionNote: string | null;
}


/** Uma única interacção de pergunta discriminadora, imutável após registo. */
export interface DiscriminationEntry {
  /** Tag de intenção: o que a pergunta tentava separar (ex: 'primary_vs_competing', 'relief_vs_control') */
  intentTag: string;
  /** A pergunta exacta apresentada ao utilizador */
  question: string;
  /** A resposta textual do utilizador (pode ser vazia se ignorou) */
  answer: string;
  /** O motor interpretou a resposta como confirmação da hipótese principal? */
  confirmedPrimary: boolean | null;
  /** Campo candidato que emergiu da discriminação (ex: 'hiddenFunctionCandidate') */
  emergentCandidate: string | null;
}

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

/** Estado do caso ativo — persiste entre sessões no mesmo browser. */
export type CaseStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface SessionMeta {
  sessionId: string;
  /** Identificador estável do caso (≠ sessionId que muda por sessão).
   *  Gerado uma vez quando o caso é criado. Nunca reutilizado.
   *  Ponto de extensão: em futuro backend, ligar este id ao userId. */
  caseId: string;
  userId?: string;
  isFirstSession: boolean;
  isRegisteredUser: boolean;
  startedAt: number;
  updatedAt: number;
  /** Timestamp da última resposta com conteúdo semântico real (não contadores de turno). */
  lastMeaningfulInteractionAt: number;
  turnCount: number;
  questionCount: number;
  answerCount: number;
  /** Estado do caso — permite distinguir exploração nova de retoma. */
  caseStatus: CaseStatus;
  /** Número de sessões que este caso já teve (incrementa em cada reentrada). */
  sessionCount: number;
  /** Verdadeiro quando existe caso retomável no mesmo browser/dispositivo. */
  resumeAvailable: boolean;
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
  /** Sprint 3: Tag de intenção da pergunta discriminadora (se aplicável)
   *  Usado pelo App.tsx para associar a resposta ao registo correcto no CaseMemory. */
  _discriminationIntentTag?: string;
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



// ─── Voice State ───────────────────────────────────────────────────────────────

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceState {
  status: VoiceStatus;
  isSupportedSTT: boolean;
  isSupportedTTS: boolean;
  transcriptDraft: string;
  lastSpokenText: string | null;
  lastError: string | null;
  audioModeEnabled: boolean;
}

export interface InternalState {
  schemaVersion: number;
export interface CaseMemory {
  currentFocus: string | null;
  provisionalHypothesis: string | null;
  competingHypothesis: string | null;
  hiddenFunctionCandidate: string | null;
  invisibleCostCandidate: string | null;
  maintenanceErrorCandidate: string | null;
  hotLeads: string[];
  userIdiolect: string[];
  assignedWork: string | null;
  progressSignals: string[];
  confidenceState: 'insufficient' | 'moderate' | 'strong';
  followUpMeta: {
    lastSessionDate: number | null;
    pendingWorkAssigned: boolean;
  };

  // ─── Sprint 3: Registo de Discriminação ────────────────────────────────────────
  // Guarda o histórico de perguntas discriminadoras feitas ao utilizador
  // para evitar repetição disfarada e actualizar confiança com base nas respostas.
  discriminationRecord: DiscriminationEntry[];

  // ─── Sprint 6: Delta entre Sessões ─────────────────────────────────────────────
  /** Último snapshot de mudança calculado na reentrada. Null na primeira sessão. */
  lastProgressDelta: ProgressDelta | null;
  /** Inferência actual sobre o que fazer com o caso. Guia o fluxo pós-reentrada. */
  followUpInference: FollowUpInference | null;

// ─── Sprint 9: Estado de Clarificação e Repair Loop ────────────────────────────
  // Regista as intenções que já foram alvo de clarificação (intentTag -> attempts).
  // Permite limitar loops (ex: max 1 reformulação por tag).
  clarificationRecord: Record<string, number>;

  // ─── Sprint 10: Extração Semântica Leve ───────────────────────────────────────
  /** Último significado substantivo extraído da resposta do utilizador */
  lastExtractedMeaning: string | null;
  /** Fragmentos exatos de frases úteis que o utilizador usou */
  userPhrasingFragments: string[];
  /** Termos isolados fortes que podem ser usados para reflexo */
  salientTerms: string[];
  
  // ─── Sprint 10B: Sinais de Correção ──────────────────────────────────────────
  /** Último sinal de correção explícito submetido pelo utilizador */
  lastCorrectionSignal: string | null;
  /** Registo da última correção aplicada ao foco ou hipótese */
  correctionNote: string | null;

  // ─── Sprint 11: Pivot Estratégico (Rastreio de Foco Probabilístico) ──────────
  /** Probabilidade atual do foco principal */
  primaryFocusProb: number | null;
  /** Lista de focos rivais que competem pela raiz do problema */
  rivalFoci: string[];
}


/** Uma única interacção de pergunta discriminadora, imutável após registo. */
export interface DiscriminationEntry {
  /** Tag de intenção: o que a pergunta tentava separar (ex: 'primary_vs_competing', 'relief_vs_control') */
  intentTag: string;
  /** A pergunta exacta apresentada ao utilizador */
  question: string;
  /** A resposta textual do utilizador (pode ser vazia se ignorou) */
  answer: string;
  /** O motor interpretou a resposta como confirmação da hipótese principal? */
  confirmedPrimary: boolean | null;
  /** Campo candidato que emergiu da discriminação (ex: 'hiddenFunctionCandidate') */
  emergentCandidate: string | null;
}

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

/** Estado do caso ativo — persiste entre sessões no mesmo browser. */
export type CaseStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface SessionMeta {
  sessionId: string;
  /** Identificador estável do caso (≠ sessionId que muda por sessão).
   *  Gerado uma vez quando o caso é criado. Nunca reutilizado.
   *  Ponto de extensão: em futuro backend, ligar este id ao userId. */
  caseId: string;
  userId?: string;
  isFirstSession: boolean;
  isRegisteredUser: boolean;
  startedAt: number;
  updatedAt: number;
  /** Timestamp da última resposta com conteúdo semântico real (não contadores de turno). */
  lastMeaningfulInteractionAt: number;
  turnCount: number;
  questionCount: number;
  answerCount: number;
  /** Estado do caso — permite distinguir exploração nova de retoma. */
  caseStatus: CaseStatus;
  /** Número de sessões que este caso já teve (incrementa em cada reentrada). */
  sessionCount: number;
  /** Verdadeiro quando existe caso retomável no mesmo browser/dispositivo. */
  resumeAvailable: boolean;
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
  /** Sprint 3: Tag de intenção da pergunta discriminadora (se aplicável)
   *  Usado pelo App.tsx para associar a resposta ao registo correcto no CaseMemory. */
  _discriminationIntentTag?: string;
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



// ─── Voice State ───────────────────────────────────────────────────────────────

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceState {
  status: VoiceStatus;
  isSupportedSTT: boolean;
  isSupportedTTS: boolean;
  transcriptDraft: string;
  lastSpokenText: string | null;
  lastError: string | null;
  audioModeEnabled: boolean;
}

export interface InternalState {
  schemaVersion: number;
  appVersion: string;
  mode: 'conversation' | 'writing';
  phase: InternalStatePhase;
  sessionStage: SessionStage;

  sessionMeta: SessionMeta;
  governance: GovernanceState;
  triageState: TriageState | null;
  continuationState: ContinuationState;
  voiceState: VoiceState;
  caseMemory: CaseMemory;

  // Bugfix: Rewind 1 step
  lastTurnSnapshot: string | null;
  lastTurnUserText: string | null;
}
