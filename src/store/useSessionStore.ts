import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { inferCaseMemoryFromTriage } from '../engine/triageEngine';
import type { InternalState, TriageState, SessionStage, CaseMemory, DiscriminationEntry } from '../types/internalState';

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
}

const CURRENT_SCHEMA_VERSION = 5;
const CURRENT_APP_VERSION = 'v5.1.Sprint3';
const EXPIRY_DAYS = 7;

const generateSessionId = () => Math.random().toString(36).substring(2, 10);
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
      isSupportedSTT: false, // We will evaluate on mount
      isSupportedTTS: false, // We will evaluate on mount
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
      discriminationRecord: []
    },
    
    sessionMeta: {
      sessionId: generateSessionId(),
      isFirstSession: true,
      isRegisteredUser: false,
      startedAt: time,
      updatedAt: time,
      turnCount: 0,
      questionCount: 0,
      answerCount: 0
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
         phase: 'TRIAGE', // fallback legacy até App.tsx suportar FOLLOW_UP_REENTRY visualmente
         sessionMeta: { ...state.sessionMeta, updatedAt: now() }
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
    }),
    {
      name: 'introspect-session-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
         if (!state) return;
         const expired = state.sessionMeta ? (now() - state.sessionMeta.updatedAt > EXPIRY_DAYS * 24 * 60 * 60 * 1000) : true;
         const badVersion = state.schemaVersion !== CURRENT_SCHEMA_VERSION;
         const missingFields = !state.caseMemory || !state.sessionStage;
         
         if (expired || badVersion || missingFields) {
            state.resetSession();
            console.log(expired ? '[Persist] Session expired (7+ dias)' : '[Persist] Schema Version mismatch ou campos em falta. Forçado reset para nova Estrutura Core.');
         } else {
            console.log(`[Persist] Sessão retomada: ${state.sessionMeta.sessionId}`);
         }
      }
    }
  )
);
