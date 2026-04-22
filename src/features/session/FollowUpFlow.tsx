/**
 * FollowUpFlow.tsx
 *
 * Sprint 5: Fluxo de reentrada real.
 * Sprint 6: Enriquecido com delta entre sessões.
 *   - Classifica mudança (melhorou/piorou/stable/shifted/too_early) via deltaEngine
 *   - Decide caseAdjustment (confirm/correct/deepen/stabilize) via caseAdjustmentEngine
 *   - Guarda delta e inferência no CaseMemory
 *   - Mostra linha de contexto de transição ao utilizador
 *
 * Render quando sessionStage === 'FOLLOW_UP_REENTRY'.
 * Apresenta sequencialmente 2–3 perguntas de follow-up.
 * Valida respostas com responseValidator antes de avançar.
 * Mostra feedback gentil se a resposta for fraca — sem bloquear brutalmente.
 */

import { useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { pickNextFollowUpQuestion } from '../../engine/reentry/reentryEngine';
import { classifyProgressDelta } from '../../engine/reentry/deltaEngine';
import { decideCaseAdjustment, buildWorkingDirectionLine } from '../../engine/reentry/caseAdjustmentEngine';
import { validateMinimumResponse } from '../../engine/validation/responseValidator';
import { decideContinuationMode } from '../../engine/continuation/continuationEngine';
import { inferReadingStageFromMemory } from '../../engine/emergentReadingEngine';
import type { FollowUpQuestion } from '../../engine/reentry/reentryEngine';

export function FollowUpFlow() {
  const updateState = useSessionStore((s) => s.updateState);
  const recordProgressSignal = useSessionStore((s) => s.recordProgressSignal);
  const markMeaningfulInteraction = useSessionStore((s) => s.markMeaningfulInteraction);
  const setCaseStatus = useSessionStore((s) => s.setCaseStatus);
  const updateProgressDelta = useSessionStore((s) => s.updateProgressDelta);
  const applyFollowUpInference = useSessionStore((s) => s.applyFollowUpInference);

  // Tags das perguntas já respondidas nesta sessão de reentrada
  const [answeredTags, setAnsweredTags] = useState<string[]>([]);
  // Respostas brutas (na mesma ordem que answeredTags) — para o deltaEngine
  const [answerCorpus, setAnswerCorpus] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionLine, setTransitionLine] = useState<string | null>(null);

  // Pergunta atual (determinística baseada no estado do store)
  const currentQuestion: FollowUpQuestion | null = pickNextFollowUpQuestion(
    useSessionStore.getState(),
    answeredTags
  );

  /**
   * Submete a resposta à pergunta atual.
   * Valida primeiro; só avança se houver conteúdo semântico real.
   */
  const handleSubmit = () => {
    if (!currentQuestion) return;

    const validation = validateMinimumResponse(inputText, 'follow_up');

    if (!validation.isValid) {
      // Feedback gentil — não bloqueia, mostra uma vez
      // Se já foi mostrado feedback antes, deixar passar (não punir em loop)
      if (!validationFeedback) {
        setValidationFeedback(validation.feedbackMessage);
        return;
      }
      // Segunda tentativa com resposta fraca: aceitar e avançar sem penalidade
    }

    // Resposta aceite (válida ou segunda tentativa)
    setValidationFeedback(null);
    const trimmedAnswer = inputText.trim();

    // Guardar resposta como progressSignal (prefixada com tag para rastreabilidade)
    recordProgressSignal(`[reentrada:${currentQuestion.tag}] ${trimmedAnswer}`);
    markMeaningfulInteraction(); // Sprint 6: ligar aqui também

    const nextAnswered = [...answeredTags, currentQuestion.tag];
    const nextCorpus = [...answerCorpus, trimmedAnswer];
    setAnsweredTags(nextAnswered);
    setAnswerCorpus(nextCorpus);
    setInputText('');

    // Verificar se há mais perguntas
    const nextQ = pickNextFollowUpQuestion(useSessionStore.getState(), nextAnswered);

    if (!nextQ) {
      // Todas as perguntas respondidas — calcular delta e transitar
      handleCompleteReentry(nextAnswered, nextCorpus);
    }
  };

  /**
   * Abandona o follow-up e vai directamente para o fluxo de continuação.
   * Calcula delta com o que existe até ao momento (pode ser parcial).
   */
  const handleSkipReentry = () => {
    handleCompleteReentry(answeredTags, answerCorpus);
  };

  /**
   * Calcula delta + ajuste, guarda no CaseMemory, e transita para CONTINUATION_ACTIVE.
   * Sprint 6: o ponto de integração central dos dois novos motores.
   */
  const handleCompleteReentry = (finalAnsweredTags: string[], responses: string[]) => {
    setIsTransitioning(true);

    setTimeout(() => {
      const currentState = useSessionStore.getState();

      // ─── Sprint 6: Calcular delta entre sessões ────────────────────────────
      const delta = classifyProgressDelta(responses);
      updateProgressDelta(delta);

      // ─── Sprint 6: Decidir ajuste do caso com base no delta ───────────────
      const inference = decideCaseAdjustment(currentState, delta);
      applyFollowUpInference(inference);

      // Linha de transição para mostrar ao utilizador antes de avançar
      const line = buildWorkingDirectionLine(inference.workingDirection);
      setTransitionLine(line);

      // ─── Transitar para o fluxo correcto ──────────────────────────────────
      setCaseStatus('active');

      // Aguardar um momento para o utilizador ver a linha de transição
      setTimeout(() => {
        const updatedState = useSessionStore.getState();
        const correctStage = inferReadingStageFromMemory(updatedState.caseMemory);
        const contState = decideContinuationMode(updatedState);

        const targetPhase = updatedState.triageState ? 'CONTINUATION_ACTIVE' : 'TRIAGE';
        const targetStage = updatedState.triageState ? correctStage : 'ENTRY_ORIENTATION';

        updateState({
          phase: targetPhase,
          sessionStage: targetStage,
          continuationState: updatedState.triageState ? contState : updatedState.continuationState,
        });
      }, 1800); // tempo suficiente para ler a linha de transição

    }, 300);
  };

  // ─── Render: transição com linha de contexto ─────────────────────────────────
  if (isTransitioning) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{ maxWidth: 480, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {transitionLine ? (
            <p style={{ color: 'var(--text-main)', fontSize: '1.05rem', lineHeight: 1.6, fontWeight: 400 }}>
              {transitionLine}
            </p>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              A retomar o caso…
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: sem mais perguntas (não devia acontecer, mas por segurança) ─────
  if (!currentQuestion) {
    handleCompleteReentry(answeredTags, answerCorpus);
    return null;
  }

  // Progresso visual
  const totalQuestions = 3;
  const progress = answeredTags.length;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: 540, width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Indicador de progresso */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div key={i} style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background: i < progress ? 'var(--accent-text)' : 'var(--border-color)',
              transition: 'background 0.3s',
            }} />
          ))}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8, whiteSpace: 'nowrap' }}>
            {progress}/{totalQuestions}
          </span>
        </div>

        {/* Pergunta */}
        <div>
          <p style={{
            fontSize: '0.78rem',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            margin: '0 0 10px 0',
          }}>
            Retoma
          </p>
          <h1 style={{
            fontSize: '1.25rem',
            lineHeight: 1.45,
            color: 'var(--text-main)',
            margin: 0,
            fontWeight: 500,
          }}>
            {currentQuestion.questionText}
          </h1>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            id="follow-up-input"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (validationFeedback) setValidationFeedback(null);
            }}
            placeholder="A tua resposta…"
            style={{
              fontSize: '0.95rem',
              minHeight: 90,
              width: '100%',
              resize: 'vertical',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          {/* Feedback de validação (gentil, não punitivo) */}
          {validationFeedback && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}>
              {validationFeedback}
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              id="btn-submit-followup"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!inputText.trim()}
              style={{ flex: 1, minWidth: 140 }}
            >
              Continuar
            </button>
            <button
              id="btn-skip-followup"
              onClick={handleSkipReentry}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
              }}
            >
              Saltar
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Podes saltar se não há nada novo a dizer.
          </p>
        </div>
      </div>
    </div>
  );
}
