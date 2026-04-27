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

import { useState, useEffect } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { classifyProgressDelta } from '../../engine/reentry/deltaEngine';

import { decideCaseAdjustment, buildWorkingDirectionLine } from '../../engine/reentry/caseAdjustmentEngine';
import { validateMinimumResponse } from '../../engine/validation/responseValidator';
import { decideContinuationMode } from '../../engine/continuation/continuationEngine';
import { inferReadingStageFromMemory } from '../../engine/emergentReadingEngine';
import type { ConversationTurnOutput, ConversationTurnRequest } from '../../shared/contracts/conversationTurnContract';

export function FollowUpFlow() {
  const updateState = useSessionStore((s) => s.updateState);
  const recordProgressSignal = useSessionStore((s) => s.recordProgressSignal);
  const markMeaningfulInteraction = useSessionStore((s) => s.markMeaningfulInteraction);
  const setCaseStatus = useSessionStore((s) => s.setCaseStatus);
  const updateProgressDelta = useSessionStore((s) => s.updateProgressDelta);
  const applyFollowUpInference = useSessionStore((s) => s.applyFollowUpInference);
  const lastTurnSnapshot = useSessionStore((s) => s.lastTurnSnapshot);

  const [answeredTags, setAnsweredTags] = useState<string[]>([]);
  const [answerCorpus, setAnswerCorpus] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionLine, setTransitionLine] = useState<string | null>(null);
  
  // Sprint 11: LLM-driven follow-up
  const [isProcessing, setIsProcessing] = useState(false);
  const [dynamicQuestionText, setDynamicQuestionText] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [llmTurnCount, setLlmTurnCount] = useState(0);

  // Primeira renderização: ir buscar a pergunta inicial do LLM
  useEffect(() => {
     let mounted = true;
     const fetchInitialQuestion = async () => {
         setIsProcessing(true);
         try {
             const state = useSessionStore.getState();
             const reqPayload: ConversationTurnRequest = {
                 sessionStage: 'REENTRY',
                 caseSummary: state.caseMemory.lastExtractedMeaning || 'Resumo indisponível',
                 currentFocus: state.caseMemory.currentFocus || null,
                 currentHypothesis: state.caseMemory.provisionalHypothesis || null,
                 lastUserInput: "Inicie a retoma do caso de forma natural e contextualizada com o resumo anterior.",
                 lastAssistantTurn: null,
                 checkpointState: null,
                 conversationDepth: 0,
                 previousCorrections: [],
                 salientTerms: state.caseMemory.salientTerms || []
             };
             const res = await fetch('/api/conversationTurn', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(reqPayload)
             });
             if (!res.ok) throw new Error('API Error');
             const turnResult: ConversationTurnOutput = await res.json();
             if (mounted) {
                 setDynamicQuestionText(turnResult.assistant_text);
                 setIsProcessing(false);
             }
         } catch (err) {
             console.warn('LLM falhou no mount, fallback para mensagem estática', err);
             if (mounted) {
                 setUseFallback(true);
                 setDynamicQuestionText("Ocorreu um erro a carregar o contexto. Como te sentes hoje?");
                 setIsProcessing(false);
             }
         }
     };
     fetchInitialQuestion();
     return () => { mounted = false; };
  }, []);

  const displayQuestionText = dynamicQuestionText;

  const handleSubmit = async () => {
    if (!displayQuestionText || isProcessing) return;

    const validation = validateMinimumResponse(inputText, 'follow_up');

    if (!validation.isValid) {
      if (!validationFeedback) {
        setValidationFeedback(validation.feedbackMessage);
        return;
      }
    }

    setValidationFeedback(null);
    setIsProcessing(true);
    const trimmedAnswer = inputText.trim();
    const currentTag = `llm_turn_${llmTurnCount}`;

    // Bugfix: guardar snapshot
    useSessionStore.getState().saveSnapshot(trimmedAnswer);

    recordProgressSignal(`[reentrada:${currentTag}] ${trimmedAnswer}`);
    markMeaningfulInteraction();

    const nextAnswered = [...answeredTags, currentTag];
    const nextCorpus = [...answerCorpus, trimmedAnswer];
    setAnsweredTags(nextAnswered);
    setAnswerCorpus(nextCorpus);
    setInputText('');

    if (!useFallback) {
      try {
        const state = useSessionStore.getState();
        const reqPayload: ConversationTurnRequest = {
          sessionStage: 'REENTRY',
          caseSummary: state.caseMemory.lastExtractedMeaning || 'Resumo indisponível',
          currentFocus: state.caseMemory.currentFocus || null,
          currentHypothesis: state.caseMemory.provisionalHypothesis || null,
          lastUserInput: trimmedAnswer,
          lastAssistantTurn: displayQuestionText,
          checkpointState: null,
          conversationDepth: llmTurnCount + 1,
          previousCorrections: [], 
          salientTerms: state.caseMemory.salientTerms || []
        };

        const res = await fetch('/api/conversationTurn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqPayload)
        });

        if (!res.ok) throw new Error('API Error');

        const turnResult: ConversationTurnOutput = await res.json();
        
        // Atualizações de memória baseadas na extração do LLM
        const memoryUpdate: any = {};
        if (turnResult.updated_focus) memoryUpdate.currentFocus = turnResult.updated_focus;
        if (turnResult.updated_hypothesis) memoryUpdate.provisionalHypothesis = turnResult.updated_hypothesis;
        
        if (Object.keys(memoryUpdate).length > 0) {
            useSessionStore.getState().updateCaseMemory(memoryUpdate);
        }

        setLlmTurnCount(prev => prev + 1);

        if (turnResult.next_action === 'proceed' || turnResult.close_session || turnResult.checkpoint_signal || llmTurnCount >= 3) {
           handleCompleteReentry(nextAnswered, nextCorpus, turnResult.target_stage, turnResult.assistant_text);
        } else {
           setDynamicQuestionText(turnResult.needs_clarification ? (turnResult.clarification_text || turnResult.assistant_text) : turnResult.assistant_text);
        }
        setIsProcessing(false);
      } catch (err: any) {
        console.error('[FollowUpFlow] Falha na chamada ao motor LLM:', err);
        setDynamicQuestionText("A ligação falhou. Se preferires, podes simplesmente saltar esta fase.");
        setUseFallback(true);
        setIsProcessing(false);
      }
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
  const handleCompleteReentry = (finalAnsweredTags: string[], responses: string[], overrideTargetStage?: string | null, assistantText?: string) => {
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
        const finalStage = overrideTargetStage || (updatedState.triageState ? 'PROVISIONAL_FOCUS' : 'ENTRY_ORIENTATION');

        updateState({
          phase: 'CONTINUATION_ACTIVE',
          sessionStage: finalStage as any,
          continuationState: {
             mode: null,
             reason: null,
             expectedValue: null,
             maxTurnsInMode: 5,
             turnsUsedInMode: 0,
             continuationResolved: false,
             failureFlags: [],
             shouldCloseAfterThisTurn: false,
             outputPayload: {
                 title: 'Explorar',
                 mainText: assistantText || 'Vamos explorar o que trouxeste hoje. Por onde queres começar?'
             }
          }
        });
      }, 1800);

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
  if (!displayQuestionText && !isProcessing) {
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
            {displayQuestionText || "A carregar..."}
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
              disabled={!inputText.trim() || isProcessing}
              style={{ flex: 1, minWidth: 140, opacity: isProcessing ? 0.7 : 1 }}
            >
              {isProcessing ? 'A pensar...' : 'Continuar'}
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
          
          {lastTurnSnapshot && (
            <div style={{ width: '100%', textAlign: 'center', marginTop: 12 }}>
              <button 
                className="btn-secondary" 
                disabled={isProcessing}
                onClick={() => {
                  const text = useSessionStore.getState().restoreSnapshot();
                  if (text !== null) {
                    setInputText(text);
                    // Como a submissão no FollowUp avança contadores, repomos a tag e corpus manualmente:
                    setAnsweredTags(prev => prev.slice(0, -1));
                    setAnswerCorpus(prev => prev.slice(0, -1));
                    setLlmTurnCount(prev => Math.max(0, prev - 1));
                  }
                }}
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', background: 'transparent' }}
              >
                ↩ Voltar e corrigir a resposta anterior
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
