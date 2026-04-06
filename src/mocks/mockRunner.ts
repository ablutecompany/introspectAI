import { MOCK_SESSIONS } from './mockSessions';
import { InputClassifier } from '../engine/classifyInput';
import { ConductorEngine } from '../engine/conductor';
import { StateUpdater } from '../engine/updateState';
import { OutcomeEngine } from '../engine/outcomeRules';
import { EcosystemMapper } from '../engine/ecosystemProfile';
import { askLLM } from '../../server/llm/client';
import type { InternalState } from '../types/internalState';

const makeInitialState = (): InternalState => ({
  sessionId: 'mock-session-123',
  mode: 'writing',
  phase: 'micro_triage',
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
  transcriptHistory: [],
  startedAt: Date.now(),
  updatedAt: Date.now(),
  schemaVersion: 1,
  appVersion: '1.0.0'
});

export async function runMockSessions() {
  for (const [key, session] of Object.entries(MOCK_SESSIONS)) {
    console.log(`\n======================================================`);
    console.log(`🚀 INICIANDO SESSÃO DE TESTE: ${session.description}`);
    console.log(`======================================================\n`);
    
    let currentState = makeInitialState();

    for (let i = 0; i < session.turns.length; i++) {
        const turnText = session.turns[i];
        console.log(`[TURNO ${i+1}] UTILIZADOR: "${turnText}"`);

        // 1. Classify
        const intent = InputClassifier.classify(turnText);
        console.log(`   -> INTENT: ${intent}`);

        // 2. Conductor Pick
        const nextMove = ConductorEngine.decideNextMove(currentState, intent as any);
        console.log(`   -> CONDUTOR DITA: ${nextMove}`);

        // 3. Fake API Call replaced with actual API logic using schemas and constraints
        const llmMock = await askLLM({
           internalState: currentState,
           userResponse: turnText,
           userIntent: intent,
           forcedNextMove: nextMove
        });

        // 4. Update Engine
        const updates = StateUpdater.enrich(currentState, intent, llmMock);
        currentState = { ...currentState, ...updates, turnIndex: currentState.turnIndex + 1 } as InternalState;
        
        console.log(`   -> FASE ATUAL: ${currentState.phase} | SCORE R: ${currentState.outcomeReadinessScore}`);
    }

    console.log(`\n✅ TESTE FECHADO - AVALIAÇÃO DE RESULTADOS:`);
    const outcome = OutcomeEngine.calculateOutcome(currentState);
    console.log(`   🏆 OUTCOME NIVEL GERADO: Level ${outcome.level} - ${outcome.type}`);
    console.log(`   📃 PAYLOAD OUTCOME:`, outcome.payload);
    
    const profile = EcosystemMapper.generateProfile(currentState);
    console.log(`   🌍 WEAR LEVEL (ECOSSISTEMA):`, profile.wearLevel);
    console.log(`\n`);
  }
}

runMockSessions();
