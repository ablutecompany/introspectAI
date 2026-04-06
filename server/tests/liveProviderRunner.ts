import { askLLM } from '../llm/client';
import type { InternalState } from '../../src/types/internalState';

const makeDummyState = (): InternalState => ({
  sessionId: 'live-test-1',
  mode: 'writing',
  phase: 'guided_exploration',
  turnIndex: 2,
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
});

export async function runLiveTest() {
  console.log('Forçando VITE_LIVE_MODE e invalidando chave para forçar falha no Provider Real e testar z-fallback.');
  
  process.env.VITE_LIVE_MODE = 'true';
  process.env.VITE_OPENAI_API_KEY = 'forced-invalid-key-for-auth-fail-test';

  const res = await askLLM({
    internalState: makeDummyState(),
    userResponse: 'Isto é um teste onde o auth fallha inevitavelmente.',
    userIntent: 'substantive',
    forcedNextMove: 'ask_open',
    inputType: 'transcribed'
  });

  console.log('\n✅ RESULTADO DO FALLBACK (O flow não se quebra mesmo com Auth Fail da LLM):');
  console.log(res);
}

runLiveTest();
