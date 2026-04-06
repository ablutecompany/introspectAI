import { create } from 'zustand';
import type { InternalState } from '../types/internalState';

interface SessionStore extends InternalState {
  setMode: (mode: 'conversation' | 'writing') => void;
  updateState: (partial: Partial<InternalState>) => void;
  incrementTurn: () => void;
  resetSession: () => void;
}

const initialState: Omit<InternalState, 'sessionId'> = {
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
};

const generateSessionId = () => Math.random().toString(36).substring(2, 10);

export const useSessionStore = create<SessionStore>((set) => ({
  sessionId: generateSessionId(),
  ...initialState,
  
  setMode: (mode) => set({ mode }),
  updateState: (partial) => set((state) => ({ ...state, ...partial })),
  incrementTurn: () => set((state) => ({ turnIndex: state.turnIndex + 1 })),
  resetSession: () => set({ sessionId: generateSessionId(), ...initialState }),
}));
