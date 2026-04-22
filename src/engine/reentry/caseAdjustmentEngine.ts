/**
 * caseAdjustmentEngine.ts
 *
 * Sprint 6: Motor de Ajuste de Caso.
 *
 * Com base no ProgressDelta (o que mudou) e no CaseMemory (o que sabemos),
 * decide qual WorkingDirection tomar de seguida:
 *
 *   confirm   → hipótese confirma-se; aprofundar dentro do mesmo foco
 *   correct   → hipótese estava errada/incompleta; redirecionar
 *   deepen    → padrão válido mas ainda falta função/tensão/custo
 *   stabilize → mais clareza, menos variação; não reabrir tudo
 *
 * Este motor é DETERMINÍSTICO — sem LLM.
 * Regras simples e honestas, documentadas abaixo.
 *
 * Ponto de extensão: Sprint 7+ usa WorkingDirection para escolher
 * o tipo de orientação / primeiro passo a dar ao utilizador.
 */

import type {
  InternalState,
  ProgressDelta,
  WorkingDirection,
  FollowUpInference,
} from '../../../types/internalState';

// ─── Motor principal ───────────────────────────────────────────────────────────

/**
 * Decide a WorkingDirection com base no delta observado e na memória do caso.
 *
 * Regras (ordem de prioridade):
 *
 * 1. Se delta = 'improved' + confidenceState = 'strong'
 *    → stabilize (o trabalho está a funcionar, não reabrir)
 *
 * 2. Se delta = 'improved' + há hipótese mas confidenceState < 'strong'
 *    → confirm (confirmar que a direção é esta, aprofundar)
 *
 * 3. Se delta = 'worsened' + há hipótese
 *    → correct (a hipótese estava incompleta ou errada — redirecionar)
 *
 * 4. Se delta = 'worsened' + sem hipótese clara
 *    → deepen (não há ponto de partida sólido; precisa de mais material)
 *
 * 5. Se delta = 'stable' + confidenceState = 'strong'
 *    → stabilize (padrão estável, hipótese clara: consolidar)
 *
 * 6. Se delta = 'stable' + sem hipótese forte
 *    → deepen (padrão mantém-se mas ainda não foi compreendido)
 *
 * 7. Se delta = 'shifted'
 *    → correct (mudou de natureza; hipótese anterior pode não se aplicar)
 *
 * 8. Se delta = 'too_early' ou ausente
 *    → deepen (não há informação suficiente; recolher mais antes de decidir)
 */
export function decideCaseAdjustment(
  state: InternalState,
  delta: ProgressDelta
): FollowUpInference {
  const memory = state.caseMemory;
  const dir = delta.changeDirection;
  const confidence = memory.confidenceState;
  const hasHypothesis = !!(memory.provisionalHypothesis || memory.currentFocus || memory.hiddenFunctionCandidate);

  // ─── Regra 1: Melhorou + forte confiança → estabilizar ──────────────────────
  if (dir === 'improved' && confidence === 'strong') {
    return buildInference('stabilize',
      'Delta positivo com hipótese confirmada — padrão a funcionar, consolidar sem reabrir.');
  }

  // ─── Regra 2: Melhorou + hipótese mas ainda não forte → confirmar ───────────
  if (dir === 'improved' && hasHypothesis) {
    return buildInference('confirm',
      'Delta positivo com hipótese em aberto — confirmar direção e aprofundar.');
  }

  // ─── Regra 3: Melhorou sem hipótese → aprofundar ────────────────────────────
  if (dir === 'improved' && !hasHypothesis) {
    return buildInference('deepen',
      'Delta positivo mas sem hipótese clara — aprofundar antes de estabilizar.');
  }

  // ─── Regra 4: Piorou + há hipótese → corrigir ───────────────────────────────
  if (dir === 'worsened' && hasHypothesis) {
    return buildInference('correct',
      'Delta negativo com hipótese existente — hipótese incompleta ou errada; redirecionar.');
  }

  // ─── Regra 5: Piorou + sem hipótese → aprofundar ────────────────────────────
  if (dir === 'worsened' && !hasHypothesis) {
    return buildInference('deepen',
      'Delta negativo sem hipótese — ainda falta base para agir; recolher mais.');
  }

  // ─── Regra 6: Estável + forte confiança → estabilizar ───────────────────────
  if (dir === 'stable' && confidence === 'strong') {
    return buildInference('stabilize',
      'Padrão estável com hipótese confirmada — consolidar o que já se sabe.');
  }

  // ─── Regra 7: Estável + confiança fraca → aprofundar ────────────────────────
  if (dir === 'stable') {
    return buildInference('deepen',
      'Padrão estável mas hipótese ainda fraca — aprofundar função/tensão/custo.');
  }

  // ─── Regra 8: Mudou de natureza → corrigir ──────────────────────────────────
  if (dir === 'shifted') {
    return buildInference('correct',
      'Padrão alterou-se — hipótese anterior pode não se aplicar; redirecionar.');
  }

  // ─── Fallback: too_early ou ausente → aprofundar ────────────────────────────
  return buildInference('deepen',
    'Delta incerto ou insuficiente — aprofundar antes de agir.');
}

// ─── Utilitário interno ────────────────────────────────────────────────────────

function buildInference(direction: WorkingDirection, reason: string): FollowUpInference {
  return {
    workingDirection: direction,
    reason,
    inferredAt: Date.now(),
  };
}

// ─── Função auxiliar pública ───────────────────────────────────────────────────

/**
 * Linha curta e humana sobre o que o sistema vai fazer com o caso.
 * Usada no FollowUpFlow para contextualizar a transição.
 * Nunca exposta como label técnica ao utilizador.
 *
 * Ponto de extensão: Sprint 7+ pode usar isto para construir
 * o primeiro passo útil de forma mais ajustada.
 */
export function buildWorkingDirectionLine(direction: WorkingDirection): string {
  switch (direction) {
    case 'confirm':
      return 'O padrão parece confirmar-se. Vamos aprofundar o que já identificámos.';
    case 'correct':
      return 'Algo mudou desde a última vez. Vamos ajustar o foco antes de continuar.';
    case 'deepen':
      return 'Ainda há espaço para perceber melhor o que está por baixo disto.';
    case 'stabilize':
      return 'O trabalho está a funcionar. Por enquanto, a melhor coisa é não reabrir tudo.';
  }
}
