import type { InternalState, ContinuationState, ContinuationMode } from '../../../types/internalState';
import { buildLatentAndGuidanceDeterministic } from '../../latentGuidanceEngine';
import { 
  hasRealCompetingHypotheses, 
  doesAmbiguityChangeAction, 
  hasStrongButUntestedHypothesis, 
  isReadingGoodEnoughToWork, 
  shouldCloseByLowMarginalValue, 
  isContinuationLikelyToRepeat 
} from './continuationHeuristics';
import { 
  getRefineUnderstandingOutput, 
  getTestHypothesisOutput, 
  getWorkFromReadingOutput, 
  getCloseNowOutput 
} from './continuationTemplates';

/**
 * Motor determinístico que herda tudo da triagem e da primeira leitura
 * e decide formal e inviolavelmente o que a app faz a partir daqui.
 * 
 * Sprint 2: Usa sinais de CaseMemory (confidenceState, competingHypothesis)
 * e o flag needsDiscrimination do motor latente para tomar decisões mais
 * honestas — sem fechar prematuramente com maturidade falsa.
 */
export function decideContinuationMode(state: InternalState): ContinuationState {
  
  // Stop-Loss de Governança (hard gate — sempre primeiro)
  if (state.governance.shouldCloseNow) {
    return buildState('close_now', 'Governance acionou Early Close (Meta/Fadiga).', 'Término higiénico antes que surja ruído.', 0, state);
  }

  // Tolerância baixa ou risco de loop repetitivo
  if (state.governance.userToleranceLevel === 'low' || isContinuationLikelyToRepeat(state) || shouldCloseByLowMarginalValue(state)) {
    return buildState('close_now', 'Ganho marginal demasiado baixo ou limite de tolerância atingido.', 'Evitar saturação e deixar o user processar o output off-app.', 0, state);
  }

  // Sprint 2: Sinal de discriminação do motor latente
  // Se o motor calculou que há ambiguidade real (foco difuso ou area místa), 
  // calcular o output do motor para obter o flag needsDiscrimination
  const motorOutput = buildLatentAndGuidanceDeterministic(state);
  const needsDiscrimination = motorOutput.needsDiscrimination;

  // Sprint 2: Hipótese competidora registada na CaseMemory também serve de sinal
  const hasCompetingHypothesisInMemory = !!state.caseMemory?.competingHypothesis;

  // Refinar Compreensão (via heurística clássica OU sinal de discriminação do motor)
  if ((hasRealCompetingHypotheses(state) && doesAmbiguityChangeAction(state)) || 
      (needsDiscrimination && hasCompetingHypothesisInMemory)) {
    return buildState('refine_understanding', 'Existem hipóteses rivais ou foco difuso — discriminação necessária antes de fechar.', 'Separar causa mecânica da causa percetual.', 1, state);
  }

  // Testar Hipótese (detalhe difuso sem competição clara — testar ancoção)
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

/** Utility internal builder */
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
    continuationResolved: mode === 'close_now' || mode === 'work_from_reading', // estes dois não pedem feedback
    failureFlags: [],
    shouldCloseAfterThisTurn: mode === 'close_now' || mode === 'work_from_reading',
    outputPayload: payload
  };
}
