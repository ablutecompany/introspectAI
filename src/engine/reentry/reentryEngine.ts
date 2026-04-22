/**
 * reentryEngine.ts
 *
 * Sprint 5: Motor de Reentrada.
 * Sprint 6: Enriquecido com suporte a delta entre sessões
 *   e resumo inteligente baseado em mudança observada.
 *
 * Responsabilidade única: dado o estado persistido de um caso anterior,
 * produzir (1) um resumo curto e humano do que ficou em aberto,
 * e (2) as perguntas de follow-up adequadas para recuperar contexto vivo.
 *
 * Não faz discriminação nem leitura emergente — esses motores são chamados
 * depois da reentrada ser processada.
 */

import type { InternalState, FrictionArea } from '../../../types/internalState';

// ─── Labels humanas por área de fricção ────────────────────────────────────────
// Nota: diferentes das labels técnicas do discriminationEngine.
// Aqui o objetivo é linguagem natural, não classificação.

const AREA_HUMAN_LABELS: Record<Exclude<FrictionArea, 'G'>, string> = {
  A: 'o que se passa no corpo',
  B: 'o cansaço e a energia',
  C: 'a ansiedade e os pensamentos',
  D: 'a sobrecarga e a sensação de descontrolo',
  E: 'as relações e o que aí pesa',
  F: 'o sentido e a direção',
};

// ─── Tipos públicos ────────────────────────────────────────────────────────────

/**
 * Resumo humano do caso anterior.
 * Consumido pela ReentryGate para mostrar ao utilizador o que ficou em aberto.
 */
export interface CaseResumeSummary {
  /** Label da área de foco principal em linguagem humana. */
  focusLabel: string;
  /** Hipótese provisória em linguagem humana, ou null se não existir. */
  hypothesisLabel: string | null;
  /** Trabalho atribuído na sessão anterior, ou null. */
  pendingWork: string | null;
  /** Número de sessões anteriores neste caso. */
  sessionCount: number;
  /** "há X dias" / "ontem" / "há uma semana" — baseado em lastMeaningfulInteractionAt. */
  lastSeenLabel: string;
  /** Verdadeiro se existia foco discriminado (não só área genérica). */
  hasConcreteHypothesis: boolean;
}

/**
 * Uma pergunta de follow-up a apresentar ao utilizador na reentrada.
 */
export interface FollowUpQuestion {
  /** Tag única — garante que não se repete a mesma pergunta. */
  tag: string;
  /** Texto da pergunta apresentado ao utilizador. */
  questionText: string;
  /** Tipo de resposta esperada (para o validador saber que contexto aplicar). */
  contextType: 'follow_up';
}

// ─── Funções auxiliares ────────────────────────────────────────────────────────

/**
 * Converte um timestamp em "há X dias", "ontem", "hoje", etc.
 * Honesto: nunca diz "recentemente" se passou mais de uma semana.
 */
function buildLastSeenLabel(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;
  if (diffDays < 14) return 'há uma semana';
  if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} semanas`;
  return `há mais de um mês`;
}

// ─── Funções principais ────────────────────────────────────────────────────────

/**
 * Constrói o resumo humano do caso para apresentar na ReentryGate.
 * Baseado no estado persistido — não inventa nem infere além do que existe.
 */
export function buildCaseResumeSummary(state: InternalState): CaseResumeSummary {
  const triage = state.triageState;
  const memory = state.caseMemory;
  const meta = state.sessionMeta;

  // Área de foco (fallback para C se não houver triagem)
  const primaryArea = (triage?.primary_problem_area ?? 'C') as Exclude<FrictionArea, 'G'>;
  const focusLabel = AREA_HUMAN_LABELS[primaryArea];

  // Hipótese provisória — usar a do caso se existir
  let hypothesisLabel: string | null = null;
  if (memory.currentFocus) {
    hypothesisLabel = memory.currentFocus;
  } else if (memory.provisionalHypothesis) {
    hypothesisLabel = memory.provisionalHypothesis;
  } else if (memory.hiddenFunctionCandidate) {
    hypothesisLabel = memory.hiddenFunctionCandidate;
  }

  // Timestamp para "há X dias"
  const lastSeenLabel = buildLastSeenLabel(
    meta.lastMeaningfulInteractionAt ?? meta.updatedAt
  );

  const hasConcreteHypothesis =
    memory.confidenceState !== 'insufficient' ||
    (memory.discriminationRecord?.length ?? 0) > 0;

  return {
    focusLabel,
    hypothesisLabel,
    pendingWork: memory.assignedWork ?? null,
    sessionCount: meta.sessionCount,
    lastSeenLabel,
    hasConcreteHypothesis,
  };
}

/**
 * Gera as perguntas de follow-up contextualizadas ao foco em aberto.
 * Determinístico — sem LLM, sem randomness.
 * As perguntas são ordenadas por relevância clínica.
 *
 * Ponto de extensão: Sprint 6+ pode adicionar perguntas baseadas
 * no delta entre sessões e nas mudanças de confidenceState.
 */
export function buildFollowUpQuestions(state: InternalState): FollowUpQuestion[] {
  const triage = state.triageState;
  const memory = state.caseMemory;

  const primaryArea = (triage?.primary_problem_area ?? 'C') as Exclude<FrictionArea, 'G'>;
  const focusLabel = AREA_HUMAN_LABELS[primaryArea];

  const questions: FollowUpQuestion[] = [
    {
      tag: 'reentry_change',
      questionText: `O que mudou desde a última vez em relação a ${focusLabel}?`,
      contextType: 'follow_up',
    },
    {
      tag: 'reentry_intensity',
      questionText: 'Isto esteve mais forte, mais fraco, ou parecido?',
      contextType: 'follow_up',
    },
    {
      tag: 'reentry_event',
      questionText: 'Aconteceu alguma coisa desde então que mexesse com este tema?',
      contextType: 'follow_up',
    },
  ];

  // Se havia trabalho atribuído, adicionar pergunta específica sobre isso
  if (memory.assignedWork) {
    questions.unshift({
      tag: 'reentry_assigned_work',
      questionText: `Ficaste de observar ${memory.assignedWork.toLowerCase()}. O que notaste?`,
      contextType: 'follow_up',
    });
  }

  return questions;
}

/**
 * Seleciona a próxima pergunta de follow-up ainda não respondida.
 * Devolve null quando todas foram respondidas (máx 3 perguntas = suficiente para reentrada).
 *
 * @param state Estado atual do caso
 * @param answeredTags Tags das perguntas já respondidas nesta sessão de reentrada
 */
export function pickNextFollowUpQuestion(
  state: InternalState,
  answeredTags: string[]
): FollowUpQuestion | null {
  const all = buildFollowUpQuestions(state);
  // Máximo de 3 perguntas por reentrada — evitar sobrecarga
  const MAX_REENTRY_QUESTIONS = 3;

  if (answeredTags.length >= MAX_REENTRY_QUESTIONS) return null;

  return all.find((q) => !answeredTags.includes(q.tag)) ?? null;
}

// ─── Sprint 6: Resumo enriquecido com delta ────────────────────────────────────

/**
 * Resumo de reentrada enriquecido — Sprint 6.
 * Inclui linha de delta da sessão anterior (quando disponível)
 * e linha de contexto para a sessão atual.
 */
export interface EnrichedResumeSummary extends CaseResumeSummary {
  /** Linha sobre como o padrão mudou desde a última vez. Null se sem história. */
  deltaLine: string | null;
  /**
   * Linha de abertura para a sessão atual, baseada no delta e na sessão.
   * Ex: "Hoje vamos perceber se o padrão se confirma ou se afinal era outra coisa."
   */
  sessionOpeningLine: string;
}

/**
 * Constrói o resumo enriquecido para a ReentryGate quando há histórico de delta.
 * Se não houver delta anterior, devolve um resumo equivalente ao buildCaseResumeSummary
 * com deltaLine = null.
 */
export function buildEnrichedResumeSummary(state: InternalState): EnrichedResumeSummary {
  const base = buildCaseResumeSummary(state);
  const delta = state.caseMemory.lastProgressDelta;
  const inference = state.caseMemory.followUpInference;

  // Linha de delta da sessão anterior
  const deltaLine = delta?.changeSummaryLine ?? null;

  // Linha de abertura baseada no que o sistema decidiu fazer
  let sessionOpeningLine: string;
  if (!inference) {
    // Primeira reentrada — sem histórico de ajuste anterior
    sessionOpeningLine = 'Hoje vamos perceber como o padrão evoluiu e onde focar a energia.';
  } else {
    switch (inference.workingDirection) {
      case 'confirm':
        sessionOpeningLine = 'Hoje vamos confirmar se a direção que encontrámos ainda faz sentido.';
        break;
      case 'correct':
        sessionOpeningLine = 'Hoje vamos ajustar o foco — algo mudou desde a última vez.';
        break;
      case 'deepen':
        sessionOpeningLine = 'Hoje vamos perceber melhor o que está por baixo disto.';
        break;
      case 'stabilize':
        sessionOpeningLine = 'O padrão parece estar a estabilizar. Hoje é para consolidar, não para reabrir.';
        break;
    }
  }

  return {
    ...base,
    deltaLine,
    sessionOpeningLine,
  };
}
