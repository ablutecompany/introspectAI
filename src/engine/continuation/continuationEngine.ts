import type { InternalState, ContinuationState, ContinuationMode } from '../../../types/internalState';
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
 */
export function decideContinuationMode(state: InternalState): ContinuationState {
  
  // Condições Stop-Loss Hardcoded (Early Close)
  if (state.governance.shouldCloseNow) {
    return buildState('close_now', 'Governance acionou Early Close (Meta/Fadiga).', 'Término higiénico antes que surja ruído.', 0, state);
  }

  // Tolerância baixa ou chance alta de Loop Repetitivo
  if (state.governance.userToleranceLevel === 'low' || isContinuationLikelyToRepeat(state) || shouldCloseByLowMarginalValue(state)) {
    return buildState('close_now', 'Ganho marginal demasiado baixo ou limite de tolerância atingido.', 'Evitar saturação e deixar o user processar o output off-app.', 0, state);
  }

  // Refinar Compreensão
  if (hasRealCompetingHypotheses(state) && doesAmbiguityChangeAction(state)) {
    return buildState('refine_understanding', 'Existem 2 hipóteses rivais e a tática correta exige distinção prévia.', 'Separar causa mecânica da causa percetual.', 1, state);
  }

  // Testar Hipótese
  if (hasStrongButUntestedHypothesis(state)) {
    return buildState('test_hypothesis', 'Informação base difusa forçou a app a prever um modelo que requer selo empírico do user.', 'Correção célere sem destruir o progresso feito.', 1, state);
  }

  // Trabalhar a Partir da Leitura
  if (isReadingGoodEnoughToWork(state)) {
    // Mode `work_from_reading` é basicamente o fim da fase de conversão e a entrega da ferramenta, terminando num output final (o max turns é 0 para impedir respingueis).
    return buildState('work_from_reading', 'Hipótese ancorada e específica, útil o suficiente para isolar a fricção material.', 'Passagem ao micro-passo visível sem voltar a sondar.', 0, state);
  }

  // Fallback (Regra de Ouro: na dúvida de valor novo e sólido, Fechar)
  return buildState('close_now', 'Ausência clara de caminho estrito de refinanciamento tático.', 'Sair pelo topo, retendo o valor da leitura original.', 0, state);
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
