import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { InternalState } from '../types/internalState';

interface SessionStore extends InternalState {
  setMode: (mode: 'conversation' | 'writing') => void;
  updateState: (partial: Partial<InternalState>) => void;
  incrementTurn: () => void;
  resetSession: () => void;
}

const CURRENT_SCHEMA_VERSION = 2;
const CURRENT_APP_VERSION = 'v2.0.HalfDuplex';
const EXPIRY_DAYS = 7;

const initialState: Omit<InternalState, 'sessionId' | 'startedAt' | 'updatedAt' | 'schemaVersion' | 'appVersion'> = {
  mode: 'conversation',
  phase: 'opening',
  turnIndex: 0,
  
  dominantHypothesis: null,
  secondaryHypothesis: null,
  rivalHypotheses: [],
  
  axisSignals: [],
  contextSignals: [],
  mechanismSignals: [],
  costSignals: [],
  fearSignals: [],
  desiredLifeSignals: [],
  protectiveSignals: [],
  
  unresolvedQuestions: [],
  testedContrasts: [],
  pendingClarifications: [],
  
  needsSimplification: false,
  needsRecentering: false,
  needsExample: false,
  needsContrasting: false,
  fatigueLevel: 'low',
  trustLevel: 'low',
  consecutiveVagueAnswers: 0,
  consecutiveDeflectiveAnswers: 0,
  
  actionableLevers: [],
  blockedLevers: [],
  
  confidenceLevel: 'insufficient',
  outcomeReadinessScore: 0,
  outcomeLevelCandidate: null,
  
  askedQuestionIds: [],
  usedReframes: [],
  collectedExamples: [],
  keyUserPhrases: [],
  transcriptHistory: []
};

const generateSessionId = () => Math.random().toString(36).substring(2, 10);
const now = () => Date.now();

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      sessionId: generateSessionId(),
      startedAt: now(),
      updatedAt: now(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: CURRENT_APP_VERSION,
      ...initialState,
      
      setMode: (mode) => set({ mode, updatedAt: now() }),
      updateState: (partial) => set((state) => ({ ...state, ...partial, updatedAt: now() })),
      incrementTurn: () => set((state) => ({ turnIndex: state.turnIndex + 1, updatedAt: now() })),
      resetSession: () => set({ 
         sessionId: generateSessionId(), 
         startedAt: now(), 
         updatedAt: now(), 
         schemaVersion: CURRENT_SCHEMA_VERSION, 
         appVersion: CURRENT_APP_VERSION, 
         ...initialState 
      }),
    }),
    {
      name: 'introspect-session-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
         if (!state) return;
         const expired = now() - state.updatedAt > EXPIRY_DAYS * 24 * 60 * 60 * 1000;
         const badVersion = state.schemaVersion !== CURRENT_SCHEMA_VERSION;
         
         if (expired || badVersion) {
            state.resetSession();
            console.log(expired ? '[Persist] Session expired (7+ dias)' : '[Persist] Schema Version mismatch. Forçado reset.');
         } else {
            console.log(`[Persist] Sessão retomada: ${state.sessionId}`);
         }
      }
    }
  )
);
