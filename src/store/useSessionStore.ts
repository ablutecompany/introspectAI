import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { inferCaseMemoryFromTriage } from '../engine/triageEngine';
import type { InternalState, TriageState, SessionStage, CaseMemory, DiscriminationEntry, CaseStatus, ProgressDelta, FollowUpInference } from '../types/internalState';

interface SessionStore extends InternalState {
  setMode: (mode: 'conversation' | 'writing') => void;
  updateState: (partial: Partial<InternalState>) => void;
  incrementTurn: () => void;
  resetSession: () => void;
  setTriageState: (triage: TriageState) => void;
  
  // Novas mutations Longitudinais Sprint 1
  setSessionStage: (stage: SessionStage) => void;
  updateCaseMemory: (partial: Partial<CaseMemory>) => void;
  addHotLead: (lead: string) => void;
  setProvisionalFocus: (focus: string) => void;
  setProvisionalHypothesis: (hypothesis: string) => void;
  setAssignedWork: (work: string) => void;
  recordProgressSignal: (signal: string) => void;
  startFollowUpReentry: () => void;
  // Sprint 3: Registo de discriminação
  recordDiscrimination: (entry: DiscriminationEntry) => void;
  updateConfidenceState: (confidence: CaseMemory['confidenceState']) => void;

  // Sprint 5: Identidade de caso e persistência
  /** Regista que houve uma interação com conteúdo semântico real. */
  markMeaningfulInteraction: () => void;
  /** Atualiza o estado do caso (active / paused / completed / abandoned). */
  setCaseStatus: (status: CaseStatus) => void;
  /**
   * Continua um caso existente (escolha do utilizador na ReentryGate).
   * Incrementa sessionCount, gera novo sessionId, mantém caseId e CaseMemory.
   */
  continueExistingCase: () => void;

  // Sprint 6: Delta entre sessões
  /** Guarda o delta calculado na reentrada atual. */
  updateProgressDelta: (delta: ProgressDelta) => void;
  /** Guarda a inferência de ajuste de caso calculada no fim do follow-up. */
  applyFollowUpInference: (inference: FollowUpInference) => void;
}

const CURRENT_SCHEMA_VERSION = 6;
const CURRENT_APP_VERSION = 'v5.1.Sprint6';
const EXPIRY_DAYS = 14;

/** Gera um id curto aleatório para sessionId (muda por sessão). */
const generateSessionId = () => Math.random().toString(36).substring(2, 10);
/**
 * Gera um caseId mais longo e estável (nunca muda dentro do mesmo caso).
 * Ponto de extensão: substituir por UUID cripto quando integrar backend.
 */
const generateCaseId = () =>
  `case_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
const now = () => Date.now();

const buildInitialState = (): Omit<InternalState, 'schemaVersion' | 'appVersion'> => {
  const time = now();
  return {
    triageState: null,
    
    continuationState: {
      mode: null,
      reason: null,
      expectedValue: null,
      maxTurnsInMode: 0,
      turnsUsedInMode: 0,
      continuationResolved: false,
      failureFlags: [],
      shouldCloseAfterThisTurn: false
    },

    voiceState: {
      status: 'idle',
      isSupportedSTT: false, // Avaliado no mount
      isSupportedTTS: false, // Avaliado no mount
      transcriptDraft: '',
      lastSpokenText: null,
      lastError: null,
      audioModeEnabled: false
    },

    mode: 'conversation',
    phase: 'TRIAGE',
    sessionStage: 'ENTRY_ORIENTATION',
    
    caseMemory: {
      currentFocus: null,
      provisionalHypothesis: null,
      competingHypothesis: null,
      hiddenFunctionCandidate: null,
      invisibleCostCandidate: null,
      maintenanceErrorCandidate: null,
      hotLeads: [],
      userIdiolect: [],
      assignedWork: null,
      progressSignals: [],
      confidenceState: 'insufficient',
      followUpMeta: {
        lastSessionDate: null,
        pendingWorkAssigned: false
      },
      discriminationRecord: [],
      // Sprint 6: campos de delta (null na primeira sessão)
      lastProgressDelta: null,
      followUpInference: null,
    },
    
    sessionMeta: {
      sessionId: generateSessionId(),
      caseId: generateCaseId(),   // Sprint 5: id estável do caso
      isFirstSession: true,
      isRegisteredUser: false,
      startedAt: time,
      updatedAt: time,
      lastMeaningfulInteractionAt: time, // Sprint 5
      turnCount: 0,
      questionCount: 0,
      answerCount: 0,
      caseStatus: 'active',       // Sprint 5
      sessionCount: 1,            // Sprint 5
      resumeAvailable: false,     // Sprint 5: só true quando reidratado com caso válido
    },

    governance: {
      userToleranceLevel: 'medium',
      conversationLoad: 'low',
      clarificationNeed: 'medium',
      permissionToExtend: 'not_asked',
      sessionNovelty: 'first',
      fatigueSignals: [],
      metaConversationDetected: false,
      valueDeliveredYet: false,
      extensionCount: 0,
      extensionOffered: false,
      extensionAccepted: null,
      shouldStopInterviewing: false,
      shouldAskExtension: false,
      shouldCloseNow: false,
      budgetProfile: 'first_session_short',
      lastGovernanceReason: null
    }
  };
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: CURRENT_APP_VERSION,
      ...buildInitialState(),
      
      setMode: (mode) => set((state) => ({ 
         mode, 
         sessionMeta: { ...state.sessionMeta, updatedAt: now() } 
      })),
      
      updateState: (partial) => set((state) => ({ 
         ...state, 
         ...partial, 
         sessionMeta: { ...state.sessionMeta, ...(partial.sessionMeta || {}), updatedAt: now() } 
      })),
      
      incrementTurn: () => set((state) => ({ 
         sessionMeta: { 
            ...state.sessionMeta, 
            turnCount: state.sessionMeta.turnCount + 1, 
            updatedAt: now() 
         } 
      })),
      
      resetSession: () => set({ 
         schemaVersion: CURRENT_SCHEMA_VERSION, 
         appVersion: CURRENT_APP_VERSION, 
         ...buildInitialState() 
      }),

      setTriageState: (triage) => set((state) => ({
        triageState: triage,
        phase: 'LATENT_READING_DISPLAY',
        sessionStage: 'PROVISIONAL_FOCUS',
        caseMemory: { ...state.caseMemory, ...inferCaseMemoryFromTriage(triage) },
        sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      // ─── Longitudinal Mutations ──────────────────────────────────────────────
      setSessionStage: (stage) => set((state) => ({
         sessionStage: stage,
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),
      
      updateCaseMemory: (partial) => set((state) => ({
         caseMemory: { ...state.caseMemory, ...partial },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),
      
      addHotLead: (lead) => set((state) => ({
         caseMemory: { ...state.caseMemory, hotLeads: [...state.caseMemory.hotLeads, lead] },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      setProvisionalFocus: (focus) => set((state) => ({
         caseMemory: { ...state.caseMemory, currentFocus: focus },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      setProvisionalHypothesis: (hypothesis) => set((state) => ({
         caseMemory: { ...state.caseMemory, provisionalHypothesis: hypothesis },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      setAssignedWork: (work) => set((state) => ({
         caseMemory: { 
            ...state.caseMemory, 
            assignedWork: work, 
            followUpMeta: { ...state.caseMemory.followUpMeta, pendingWorkAssigned: !!work } 
         },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      recordProgressSignal: (signal) => set((state) => ({
         caseMemory: { ...state.caseMemory, progressSignals: [...state.caseMemory.progressSignals, signal] },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      startFollowUpReentry: () => set((state) => ({
         sessionStage: 'FOLLOW_UP_REENTRY',
         phase: 'CONTINUATION_ACTIVE', // Sprint 5: já não cai em TRIAGE cegamente
         sessionMeta: {
           ...state.sessionMeta,
           updatedAt: now(),
           sessionCount: state.sessionMeta.sessionCount + 1, // incrementa cada reentrada
           sessionNovelty: 'recurring',
         } as typeof state.sessionMeta,
         governance: { ...state.governance, sessionNovelty: 'recurring', budgetProfile: 'recurring_normal' }
      })),

      // Sprint 3: Gravar entrada de discriminação no histório de caso
      recordDiscrimination: (entry) => set((state) => ({
         caseMemory: {
            ...state.caseMemory,
            discriminationRecord: [...(state.caseMemory.discriminationRecord ?? []), entry]
         },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      updateConfidenceState: (confidence) => set((state) => ({
         caseMemory: { ...state.caseMemory, confidenceState: confidence },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      // ─── Sprint 5: Identidade de caso ─────────────────────────────────────────

      /** Regista interação com conteúdo semântico real (não ruído de turno). */
      markMeaningfulInteraction: () => set((state) => ({
         sessionMeta: {
           ...state.sessionMeta,
           lastMeaningfulInteractionAt: now(),
           updatedAt: now()
         }
      })),

      /** Muda o status do caso (ex: 'completed' quando sessão fecha). */
      setCaseStatus: (status) => set((state) => ({
         sessionMeta: { ...state.sessionMeta, caseStatus: status, updatedAt: now() }
      })),

      /**
       * Continua um caso existente — chamado quando o utilizador escolhe
       * "Continuar de onde fiquei" na ReentryGate.
       * Preserva: caseId, caseMemory, triageState, sessionCount
       * Renova: sessionId, updatedAt, phase (para CONTINUATION_ACTIVE via FOLLOW_UP_REENTRY)
       *
       * Ponto de extensão: aqui é onde sincronizar com backend no futuro.
       */
      continueExistingCase: () => set((state) => ({
         sessionStage: 'FOLLOW_UP_REENTRY',
         phase: 'CONTINUATION_ACTIVE',
         sessionMeta: {
           ...state.sessionMeta,
           sessionId: generateSessionId(), // nova sessão, mesmo caso
           sessionCount: state.sessionMeta.sessionCount + 1,
           isFirstSession: false,
           resumeAvailable: false, // consumido — já estamos na reentrada
           caseStatus: 'active',
           updatedAt: now(),
         },
         governance: { ...state.governance, sessionNovelty: 'recurring', budgetProfile: 'recurring_normal' }
      })),

      // ─── Sprint 6: Delta entre sessões ────────────────────────────────────────

      /** Guarda o ProgressDelta calculado no fim do follow-up de reentrada. */
      updateProgressDelta: (delta) => set((state) => ({
         caseMemory: {
           ...state.caseMemory,
           lastProgressDelta: delta,
         },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),

      /**
       * Guarda a inferência de ajuste (confirm/correct/deepen/stabilize).
       * Também actualiza followUpMeta.lastSessionDate para rastrear a última sessão.
       */
      applyFollowUpInference: (inference) => set((state) => ({
         caseMemory: {
           ...state.caseMemory,
           followUpInference: inference,
           followUpMeta: {
             ...state.caseMemory.followUpMeta,
             lastSessionDate: now(),
           }
         },
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
      })),
    }),
    {
      name: 'introspect-session-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
         if (!state) return;

         const elapsed = state.sessionMeta ? (now() - state.sessionMeta.updatedAt) : Infinity;
         const expired = elapsed > EXPIRY_DAYS * 24 * 60 * 60 * 1000;
         const badVersion = state.schemaVersion !== CURRENT_SCHEMA_VERSION;
         const missingFields = !state.caseMemory || !state.sessionStage || !state.sessionMeta?.caseId;
         
         if (expired || badVersion || missingFields) {
            // Reset limpo — schema mudou ou dados corrompidos
            state.resetSession();
            console.log(
              expired ? '[Persist] Caso expirado (14+ dias) — sessão limpa.'
              : '[Persist] Schema v' + state.schemaVersion + ' incompatível com v' + CURRENT_SCHEMA_VERSION + ' — reset forçado.'
            );
         } else {
            // Caso válido encontrado — marcar como retomável
            // O utilizador ainda não escolheu continuar; só apresentamos a opção.
            state.sessionMeta.resumeAvailable = true;
            state.sessionMeta.updatedAt = now();
            console.log(
              `[Persist] Caso retomável: ${state.sessionMeta.caseId} | sessões: ${state.sessionMeta.sessionCount} | fase: ${state.sessionStage}`
            );
         }
      }
    }
  )
);
