/**
 * deltaEngine.ts
 *
 * Sprint 6: Motor de Delta entre Sessões.
 *
 * Responsabilidade única: dada uma coleção de respostas de follow-up,
 * classificar a direção da mudança observada entre sessões.
 *
 * Eixos analisados (todos heurísticos, sem LLM):
 * - intensidade percebida (mais forte / mais fraco)
 * - frequência percebida (mais vezes / menos vezes)
 * - controlo percebido (mais controlo / menos controlo)
 * - clareza percebida (mais claro / mais confuso)
 * - natureza do padrão (igual / diferente)
 *
 * Não finge métricas exactas. O resultado é uma classificação honesta
 * com nível de confiança baixo/médio — nunca "certo".
 *
 * Ponto de extensão: Sprint 7+ pode usar o delta para escolher
 * o primeiro passo útil mais ajustado ao que mudou.
 */

import type { ChangeDirection, ProgressDelta } from '../../../types/internalState';

// ─── Mapeamento de sinais ───────────────────────────────────────────────────────

/**
 * Palavras-chave que sinalizam cada direção.
 * Listas conservadoras — só tokens com sinal claro e inequívoco.
 * Expandir com cautela: falsos positivos são piores do que silêncio.
 */
const IMPROVED_SIGNALS = [
  // Melhoria directa
  'melhorou', 'melhor', 'aliviou', 'alivio', 'alívio', 'reduziu', 'menos',
  'acalmou', 'calmo', 'calmou', 'passou', 'diminuiu', 'baixou',
  'mais fácil', 'mais facil', 'controlado', 'mais controlo', 'claro',
  'mais claro', 'clareza', 'percebo', 'consigo', 'estável', 'estavel',
  // Frequência / intensidade positiva
  'menos vezes', 'menos frequente', 'não aconteceu', 'não me afetou',
  'nao me afetou', 'tranquilo', 'tranquila', 'descansado', 'descansada',
];

const WORSENED_SIGNALS = [
  // Piora directa
  'piorou', 'pior', 'aumentou', 'mais forte', 'mais intenso', 'mais intenso',
  'mais frequente', 'mais vezes', 'mais difícil', 'mais dificil',
  'mais pesado', 'mais pesada', 'mais ansioso', 'mais ansiosa',
  'perdido', 'perdida', 'caos', 'caótico', 'caotico', 'descontrolado',
  'descontrolada', 'preso', 'presa', 'travado', 'travada', 'bloqueado',
  // Intensidade negativa
  'muito mais', 'bem pior', 'horrível', 'horrible', 'insuportável',
  'insuportavel', 'não consigo', 'nao consigo', 'sem conseguir',
];

const STABLE_SIGNALS = [
  // Manutenção / sem mudança
  'igual', 'o mesmo', 'a mesma', 'parecido', 'parecida', 'similar',
  'não mudou', 'nao mudou', 'continua', 'manteve', 'mantém', 'mantem',
  'como antes', 'mais ou menos', 'mais ou mns', 'nada de novo',
  'sem novidades', 'sem mudança', 'sem mudanca', 'não alterou',
  'nao alterou', 'nem melhor nem pior', 'neutro', 'neutra',
];

const SHIFTED_SIGNALS = [
  // Mudança de natureza — diferente mas não avaliável como melhor/pior
  'diferente', 'mudou', 'não é a mesma coisa', 'outro tipo',
  'transformou', 'ficou diferente', 'mas diferente', 'mudou de',
  'nao é o mesmo', 'não é o mesmo', 'já não é', 'ja nao e',
  'virou', 'tornou-se', 'parece outra coisa', 'estranhamente',
  'de outra forma', 'noutro sítio', 'noutro sitio',
];

const TOO_EARLY_SIGNALS = [
  // Incerteza honesta
  'não sei', 'nao sei', 'difícil dizer', 'dificil dizer', 'cedo',
  'muito cedo', 'ainda não', 'ainda nao', 'não tenho a certeza',
  'nao tenho a certeza', 'sem saber', 'talvez', 'talvez sim', 'talvez não',
  'confuso', 'confusa', 'não percebi', 'nao percebi', 'não reparei',
  'nao reparei', 'não notei', 'nao notei',
];

// ─── Classificador principal ───────────────────────────────────────────────────

/**
 * Conta sinais de cada direção numa string de texto.
 */
function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s)).length;
}

/**
 * Classifica a direção da mudança a partir de múltiplas respostas de follow-up.
 *
 * @param responses Array de respostas brutas do utilizador às perguntas de reentrada
 * @returns ProgressDelta com a direção classificada e nível de confiança
 */
export function classifyProgressDelta(responses: string[]): ProgressDelta {
  if (responses.length === 0 || responses.every((r) => !r.trim())) {
    return buildDelta('too_early', 0, null, 'Sem respostas de follow-up para classificar.');
  }

  // Juntar todas as respostas num corpus para análise
  const corpus = responses.join(' ');

  const scores: Record<ChangeDirection, number> = {
    improved: countSignals(corpus, IMPROVED_SIGNALS),
    worsened: countSignals(corpus, WORSENED_SIGNALS),
    stable: countSignals(corpus, STABLE_SIGNALS),
    shifted: countSignals(corpus, SHIFTED_SIGNALS),
    too_early: countSignals(corpus, TOO_EARLY_SIGNALS),
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  // Se não há sinais suficientes, honestamente: too_early
  if (total === 0) {
    return buildDelta('too_early', 0, null, 'Sinais insuficientes nas respostas.');
  }

  // Encontrar a direção dominante
  const dominant = (Object.entries(scores) as [ChangeDirection, number][])
    .sort(([, a], [, b]) => b - a)[0];

  const [direction, dominantScore] = dominant;

  // Confiança: proporção dos sinais dominantes sobre o total
  const confidence = Math.min(dominantScore / Math.max(total, 1), 1);

  // Se a confiança for baixa (< 0.4) e não for 'too_early', manter 'too_early'
  if (confidence < 0.4 && direction !== 'too_early') {
    return buildDelta('too_early', confidence, null, `Sinais ambíguos: ${direction} possível mas insuficiente (${Math.round(confidence * 100)}%).`);
  }

  // Linha humana sobre o que mudou (para ReentryGate futura)
  const summaryLine = buildChangeSummaryLine(direction);

  return buildDelta(direction, confidence, summaryLine, `Direção dominante: ${direction} (${Math.round(confidence * 100)}% confiança, ${dominantScore}/${total} sinais).`);
}

// ─── Utilitários internos ──────────────────────────────────────────────────────

function buildDelta(
  direction: ChangeDirection,
  confidence: number,
  summaryLine: string | null,
  _debugReason: string
): ProgressDelta {
  return {
    changeDirection: direction,
    changeConfidence: confidence,
    changeSummaryLine: summaryLine,
    calculatedAt: Date.now(),
  };
}

/**
 * Linha humana sobre o que mudou — usada na próxima ReentryGate.
 * Curta, directa, sem soar a relatório clínico.
 */
function buildChangeSummaryLine(direction: ChangeDirection): string | null {
  switch (direction) {
    case 'improved':
      return 'Da última vez para cá, isto parece ter aliviado um pouco.';
    case 'worsened':
      return 'Da última vez para cá, isto parece ter ficado mais pesado.';
    case 'stable':
      return 'Da última vez para cá, o padrão manteve-se sem grandes mudanças.';
    case 'shifted':
      return 'Da última vez para cá, isto parece ter mudado de forma — não necessariamente melhor ou pior.';
    case 'too_early':
      return null; // Não dizer nada se não há clareza
  }
}
