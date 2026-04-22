/**
 * continuationEngine.ts
 *
 * Motor determinístico que herda tudo da triagem e da primeira leitura
 * e decide formal e inviolavelmente o que a app faz a partir daqui.
 *
 * Sprint 2: Usa sinais de CaseMemory (confidenceState, competingHypothesis)
 * e o flag needsDiscrimination do motor latente para tomar decisões mais
 * honestas — sem fechar prematuramente com maturidade falsa.
 *
 * Sprint 7: Lê followUpInference.workingDirection para sessões de reentrada.
 * Quando workingDirection está disponível, ele toma precedência sobre as
 * heurísticas clássicas (que foram calculadas só com dados da primeira sessão).
 *
 * Ordem de prioridade:
 * 1. Stop-Loss de Governança (hard gate — inviolável)
 * 2. Tolerância baixa / repetição (hard gate)
 * 3. Sprint 7: WorkingDirection (se sessão de reentrada com follow-up respondido)
 * 4. Heurísticas clássicas de primeira sessão
 * 5. Fallback honesto
 */

import type { InternalState, ContinuationState, ContinuationMode, WorkingDirection } from '../../../types/internalState';
import { buildLatentAndGuidanceDeterministic } from '../latentGuidanceEngine';
import {
  hasRealCompetingHypotheses,
  doesAmbiguityChangeAction,
  hasStrongButUntestedHypothesis,
  isReadingGoodEnoughToWork,
  shouldCloseByLowMarginalValue,
  isContinuationLikelyToRepeat,
  isReturnSessionWithInference,
} from './continuationHeuristics';
import {
  getRefineUnderstandingOutput,
  getTestHypothesisOutput,
  getWorkFromReadingOutput,
  getCloseNowOutput,
  getDirectedContinuationOutput,
} from './continuationTemplates';

export function decideContinuationMode(state: InternalState): ContinuationState {

  // ─── Stop-Loss de Governança (hard gate — sempre primeiro) ───────────────────
  if (state.governance.shouldCloseNow) {
    return buildState('close_now', 'Governance acionou Early Close (Meta/Fadiga).', 'Término higiénico antes que surja ruído.', 0, state);
  }

  // ─── Tolerância baixa ou risco de loop repetitivo ────────────────────────────
  if (state.governance.userToleranceLevel === 'low' || isContinuationLikelyToRepeat(state) || shouldCloseByLowMarginalValue(state)) {
    return buildState('close_now', 'Ganho marginal demasiado baixo ou limite de tolerância atingido.', 'Evitar saturação e deixar o user processar o output off-app.', 0, state);
  }

  // ─── Sprint 7: WorkingDirection (sessão de reentrada com follow-up respondido) ──
  // Quando existe followUpInference, o sistema já calculou a trajectória correcta
  // com base no delta real entre sessões. Usar isso em vez das heurísticas de triagem.
  //
  // Excepção: se a governance quiser fechar, já foi apanhado atrás.
  // Excepção: se a trajectória for 'correct' e há hipóteses rivais activas,
  //   deixar o motor de discriminação actuar (é mais específico para esse caso).
  if (isReturnSessionWithInference(state)) {
    const inference = state.caseMemory.followUpInference!;
    const direction = inference.workingDirection;

    // 'correct' com hipóteses rivais claras → deixar discriminar (mais preciso)
    const hasActiveRivalry = hasRealCompetingHypotheses(state) && doesAmbiguityChangeAction(state);
    if (direction === 'correct' && hasActiveRivalry) {
      return buildState(
        'refine_understanding',
        'WorkingDirection=correct + hipóteses rivais activas — discriminação necessária.',
        'Separar causa real da anterior hipótese incorrecta.',
        1, state
      );
    }

    // Todos os outros casos: usar a família de template dirigida
    return buildDirectedState(direction, state);
  }

  // ─── Heurísticas clássicas de primeira sessão (Sprint 1–2) ──────────────────

  // Sinal de discriminação do motor latente
  const motorOutput = buildLatentAndGuidanceDeterministic(state);
  const needsDiscrimination = motorOutput.needsDiscrimination;

  const hasCompetingHypothesisInMemory = !!state.caseMemory?.competingHypothesis;

  // Refinar Compreensão (hipóteses rivais OU sinal de discriminação)
  if ((hasRealCompetingHypotheses(state) && doesAmbiguityChangeAction(state)) ||
      (needsDiscrimination && hasCompetingHypothesisInMemory)) {
    return buildState('refine_understanding', 'Existem hipóteses rivais ou foco difuso — discriminação necessária antes de fechar.', 'Separar causa mecânica da causa percetual.', 1, state);
  }

  // Testar Hipótese (detalhe difuso sem competição clara)
  if (hasStrongButUntestedHypothesis(state)) {
    return buildState('test_hypothesis', 'Informação base difusa forçou a app a prever um modelo que requer selo empírico do user.', 'Correção célere sem destruir o progresso feito.', 1, state);
  }

  // Trabalhar a Partir da Leitura (hipótese suficientemente sólida)
  if (isReadingGoodEnoughToWork(state)) {
    return buildState('work_from_reading', 'Hipótese ancorada e específica, útil o suficiente para isolar a fricção material.', 'Passagem ao micro-passo visível sem voltar a sondar.', 0, state);
  }

  // Fallback honesto: na dúvida, fechar sem fingir maturidade
  return buildState('close_now', 'Ausência clara de caminho estrito de refinamento tático.', 'Sair pelo topo, retendo o valor da hipótese provisória.', 0, state);
}

// ─── Builders internos ────────────────────────────────────────────────────────

/**
 * Builder para o modo dirigido por WorkingDirection (Sprint 7).
 * A trajectória é sempre 'work_from_reading' internamente (não pede input extra),
 * mas o outputPayload vem da família de templates correcta.
 *
 * Excepção: 'correct' e 'deepen' podem pedir um optionalPrompt (deixam a sessão aberta).
 */
function buildDirectedState(
  direction: WorkingDirection,
  state: InternalState
): ContinuationState {
  const payload = getDirectedContinuationOutput(state, direction);

  // Confirm e stabilize: não precisam de resposta — fechar depois de mostrar
  // Correct e deepen: podem ter optionalPrompt — deixar aberto 1 turno
  const needsResponse = direction === 'correct' || direction === 'deepen';
  const modeInternal: ContinuationMode = needsResponse ? 'refine_understanding' : 'work_from_reading';

  return {
    mode: modeInternal,
    reason: `Sprint 7: WorkingDirection=${direction}`,
    expectedValue: directionExpectedValue[direction],
    maxTurnsInMode: needsResponse ? 1 : 0,
    turnsUsedInMode: 0,
    continuationResolved: !needsResponse,
    failureFlags: [],
    shouldCloseAfterThisTurn: !needsResponse,
    outputPayload: payload,
  };
}

const directionExpectedValue: Record<WorkingDirection, string> = {
  confirm: 'Consolidar a leitura existente e avançar para um passo útil observável.',
  correct: 'Recentrar o foco com base na mudança observada entre sessões.',
  deepen: 'Aprofundar função oculta, tensão ou custo ainda não nomeados.',
  stabilize: 'Consolidar o que está a funcionar sem reabrir o que já assentou.',
};

/** Utility internal builder (templates clássicos) */
function buildState(
  mode: ContinuationMode,
  reason: string,
  expectedValue: string,
  maxTurns: number,
  originalState: InternalState
): ContinuationState {

  let payload;
  switch (mode) {
    case 'refine_understanding': payload = getRefineUnderstandingOutput(originalState); break;
    case 'test_hypothesis': payload = getTestHypothesisOutput(originalState); break;
    case 'work_from_reading': payload = getWorkFromReadingOutput(originalState); break;
    case 'close_now': payload = getCloseNowOutput(originalState, originalState.governance.lastGovernanceReason); break;
  }

  return {
    mode,
    reason,
    expectedValue,
    maxTurnsInMode: maxTurns,
    turnsUsedInMode: 0,
    continuationResolved: mode === 'close_now' || mode === 'work_from_reading',
    failureFlags: [],
    shouldCloseAfterThisTurn: mode === 'close_now' || mode === 'work_from_reading',
    outputPayload: payload
  };
}
