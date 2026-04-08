import type { InternalState } from '../../../types/internalState';

/**
 * 1. hasRealCompetingHypotheses
 * Entra se existem 2 hipóteses rivais vivas.
 * Heurística: Temos um secondary problem area validado, E o detalhe é 'specific', E a governance clarificatonNeed é alta/médio.
 */
export function hasRealCompetingHypotheses(state: InternalState): boolean {
  if (!state.triageState) return false;
  
  const hasSecondary = state.triageState.path === 'mixed' && state.triageState.secondary_problem_area !== null;
  const isSpecific = state.triageState.detail_level === 'specific';
  
  return hasSecondary && isSpecific;
}

/**
 * 2. doesAmbiguityChangeAction
 * Ambas alteram a orientação? Se for B (Exaustão) ou C (Mente), tratar um como o outro dita métodos opostos.
 */
export function doesAmbiguityChangeAction(state: InternalState): boolean {
  if (!state.triageState) return false;
  
  // Qualquer conflito entre E (Relações) e Sentido (F) ou Corpo(A)/Mente(C) e Energia(B) tende a alterar radicalmente o action.
  return hasRealCompetingHypotheses(state); // Por agora, assumimos que todo o mixed-path validado carece de precisão cirúrgica.
}

/**
 * 3. hasStrongButUntestedHypothesis
 * Já existe uma hipótese principal, o utilizador ainda não a viu explicitada.
 * Heurística: O detalhe estava 'reserved_diffuse', significando que as infos dadas foram fracas, mas o sistema ancorou numa Root. Temos de testar.
 */
export function hasStrongButUntestedHypothesis(state: InternalState): boolean {
  if (!state.triageState) return false;
  
  // Se for uma área dura (A, E, F) mas detalhe difuso, a hipótese tem de ser confirmada perentoriamente.
  return state.triageState.detail_level === 'reserved_diffuse';
}

/**
 * 4. isReadingGoodEnoughToWork
 * A hipótese já é boa o suficiente, interpretar mais seria redundante.
 * Heurística: Detalhe foi 'specific', não temos competing hypotheses bloqueantes, e o goal favorece pragmatismo (D, C, A).
 */
export function isReadingGoodEnoughToWork(state: InternalState): boolean {
  if (!state.triageState) return false;
  if (state.governance.shouldCloseNow) return false;

  const isSpecific = state.triageState.detail_level === 'specific';
  const hasNoMajorAmbiguity = !hasRealCompetingHypotheses(state) || doesAmbiguityChangeAction(state) === false;
  
  return isSpecific && hasNoMajorAmbiguity;
}

/**
 * 5. shouldCloseByLowMarginalValue
 * Ganho marginal previsto é baixo ou a continuação não ajudaria.
 */
export function shouldCloseByLowMarginalValue(state: InternalState): boolean {
  if (!state.triageState) return true;

  // Se o goal é F (Sentido longo) e a tolerance é baixa
  const isGoalF = state.triageState.immediate_goal === 'F';
  const isToleranceLow = state.governance.userToleranceLevel === 'low';
  
  return isGoalF && isToleranceLow;
}

/**
 * 6. isContinuationLikelyToRepeat
 * Heurística mecânica para travar "Test_hypothesis" se a pessoa só responde mono-silabos.
 */
export function isContinuationLikelyToRepeat(state: InternalState): boolean {
  // Se já bateu na extensão uma vez, probabilidade de repetição cega (Parrot Echoing) é brutal.
  return state.governance.extensionCount > 0 || state.governance.fatigueSignals.length >= 2;
}
