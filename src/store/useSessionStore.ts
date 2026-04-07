import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { InternalState } from '../types/internalState';

interface SessionStore extends InternalState {
  setMode: (mode: 'conversation' | 'writing') => void;
  updateState: (partial: Partial<InternalState>) => void;
  incrementTurn: () => void;
  resetSession: () => void;
}

const CURRENT_SCHEMA_VERSION = 3;
const CURRENT_APP_VERSION = 'v3.0.Engine';
const EXPIRY_DAYS = 7;

const generateSessionId = () => Math.random().toString(36).substring(2, 10);
const now = () => Date.now();

const buildInitialState = (): Omit<InternalState, 'schemaVersion' | 'appVersion'> => {
  const time = now();
  return {
    mode: 'conversation',
    phase: 'SESSION_INIT',
    
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
      extensionCount: 0
    },

    caseStructure: {
      caseField: null,
      surfaceTheme: null,
      surfaceNature: null,
      primaryFunction: null,
      mainCost: null,
      contrastResolution: null,
      openAmbiguities: []
    },

    latentModel: {
      deeperTheme: null,
      latentHypothesis: null,
      centralTension: null,
      maintenanceLoop: null,
      hiddenCost: null,
      confidenceLevel: 'insufficient'
    },

    guidanceModel: {
      repositioningFrame: null,
      keyDistinction: null,
      prematureActionToAvoid: null,
      microStep: null,
      nextQuestionIfNeeded: null
    },

    continuityMemory: {
      priorCaseTheme: null,
      priorLatentHypothesis: null,
      priorPrimaryFunction: null,
      priorCentralTension: null,
      priorMainCost: null,
      priorOpenAmbiguities: [],
      priorMicroStep: null,
      userResponseToLastStep: null,
      toleranceStyle: null,
      preferredDepth: null,
      preferredMode: null
    },

    askedQuestionIds: [],
    transcriptHistory: []
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
    }),
    {
      name: 'introspect-session-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
         if (!state) return;
         const expired = state.sessionMeta ? (now() - state.sessionMeta.updatedAt > EXPIRY_DAYS * 24 * 60 * 60 * 1000) : true;
         const badVersion = state.schemaVersion !== CURRENT_SCHEMA_VERSION;
         
         if (expired || badVersion) {
            state.resetSession();
            console.log(expired ? '[Persist] Session expired (7+ dias)' : '[Persist] Schema Version mismatch. Forçado reset para nova Estrutura Core.');
         } else {
            console.log(`[Persist] Sessão retomada: ${state.sessionMeta.sessionId}`);
         }
      }
    }
  )
);
