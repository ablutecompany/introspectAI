import { SESSION_CORPUS } from '../eval/sessionCorpus';
import { InputClassifier } from '../engine/classifyInput';
import { ConductorEngine } from '../engine/conductor';
import { StateUpdater } from '../engine/updateState';
import { OutcomeEngine } from '../engine/outcomeRules';
import { OutcomeChecks } from '../eval/outcomeChecks';
import { ScoreSession } from '../eval/scoreSession';
import { askLLM } from '../../server/llm/client';
import type { InternalState } from '../types/internalState';

const makeInitialState = (): InternalState => ({
  sessionId: 'replay-test-123',
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
  collectedExamples: [],
  keyUserPhrases: [],
  transcriptHistory: [],
  startedAt: Date.now(),
  updatedAt: Date.now(),
  schemaVersion: 1,
  appVersion: '1.0.0'
});

export async function runReplays() {
  const reports = [];

  for (const session of Object.values(SESSION_CORPUS)) {
    console.log(`\n======================================================`);
    console.log(`⏱ REPLAY: [S${session.id}] ${session.description}`);
    console.log(`======================================================\n`);
    
    let currentState = makeInitialState();
    let driftIntercepts = 0;
    let simplificationRequests = 0;

    for (let i = 0; i < session.turns.length; i++) {
        const turnText = session.turns[i];
        
        const intent = InputClassifier.classify(turnText);
        if (intent === 'deflective') driftIntercepts++;
        if (intent === 'simplify_request') simplificationRequests++;

        const nextMove = ConductorEngine.decideNextMove(currentState, intent as any);
        const llmMock = await askLLM({
           internalState: currentState,
           userResponse: turnText,
           userIntent: intent as any,
           forcedNextMove: nextMove
        });

        const updates = StateUpdater.enrich(currentState, intent as any, llmMock);
        currentState = { ...currentState, ...updates, turnIndex: currentState.turnIndex + 1 } as InternalState;
    }

    const outcome = OutcomeEngine.calculateOutcome(currentState);
    const checks = OutcomeChecks.evaluateQuality(outcome, session.turns);
    
    const score = ScoreSession.score({
        totalTurns: session.turns.length,
        driftIntercepts,
        simplificationRequests,
        finalPhase: currentState.phase,
        quality: checks,
        readinessScore: currentState.outcomeReadinessScore
    });

    reports.push({
        id: session.id,
        verdict: score.finalVerdict,
        score
    });

    console.log(`✅ AVALIAÇÃO: ${score.finalVerdict} (Timing: ${score.timingScore}/10 | Specificity: ${score.outcomeSpecificityScore}/10)`);
  }

  console.log(`\n======================================================`);
  console.log(`📊 RELATÓRIO FINAL DO MOTOR`);
  console.log(`======================================================`);
  const solid = reports.filter(r => r.verdict === 'PASSED_SOLID').length;
  const warnings = reports.filter(r => r.verdict === 'PASSED_WITH_WARNINGS').length;
  const failed = reports.filter(r => r.verdict === 'FAILED').length;
  console.log(`Foram processadas 12 sessões críticas.`);
  console.log(`- PASSED_SOLID: ${solid}`);
  console.log(`- WARNED: ${warnings}`);
  console.log(`- FAILED: ${failed}`);
  console.log(`\nSe houver Failed/Warnings, a pipeline requer mais liminares em transitions.ts ou ajustes na prompt.`);
}

runReplays();
