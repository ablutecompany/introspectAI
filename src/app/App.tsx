import { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { ConductorEngine } from '../engine/conductor';
import { StateUpdater } from '../engine/updateState';
import { InputClassifier } from '../engine/classifyInput';
import type { UserIntent } from '../engine/classifyInput';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useTTS } from '../hooks/useTTS';
import { PostSessionFeedback } from '../features/feedback/PostSessionFeedback';
import { DebugPanel } from '../dev/DebugPanel';
import './index.css';

// ─── Chip Maps por fase ───────────────────────────────────────────────────────
const CHIPS_BY_PHASE: Record<string, string[]> = {
  FIELD: [
    'desejo / relação',
    'conflito interno',
    'decisão difícil',
    'padrão que se repete',
    'trabalho / poder',
    'identidade / rumo',
    'perda / afastamento',
    'corpo / impulso / hábito',
    'outro'
  ],
  NATURE: [
    'uma pessoa concreta',
    'uma fantasia / ideia',
    'algo proibido',
    'uma necessidade minha',
    'um medo',
    'uma decisão adiada',
    'um padrão antigo',
    'outra coisa'
  ],
  FUNCTION: [
    'alívio',
    'excitação',
    'confirmação',
    'vitalidade',
    'refúgio',
    'controlo',
    'esperança',
    'distração',
    'outra coisa'
  ],
  COST: [
    'paz',
    'clareza',
    'energia',
    'liberdade',
    'desejo por outras coisas',
    'relação comigo',
    'relação com alguém',
    'tempo',
    'outra coisa'
  ]
};

const CHIP_PHASES = new Set(['FIELD', 'NATURE', 'FUNCTION', 'COST']);

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function App() {
  const {
    mode, phase, sessionMeta, governance, caseStructure, latentModel, guidanceModel,
    setMode, updateState, incrementTurn, resetSession
  } = useSessionStore();

  const { isListening, transcript, toggleListening, startListening, stopListening, manualSetTranscript, error: sttError, isSupported } = useSpeechInput();
  const { speak, stop: stopTTS, isSpeaking } = useTTS();

  const [currentQuestion, setCurrentQuestion] = useState('');
  const [lastMoveType, setLastMoveType] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionError, setConnectionError] = useState<{ failedText: string; failedIntent: UserIntent | 'auto'; errorMessage?: string } | null>(null);
  const [showTranscriptInput, setShowTranscriptInput] = useState(false);
  const [isResuming, setIsResuming] = useState(() => useSessionStore.getState().sessionMeta.turnCount > 0);

  // TTS auto-play on new question in conversation mode
  useEffect(() => {
    if (mode === 'conversation' && currentQuestion) {
      speak(currentQuestion, () => {
        if (sessionMeta.turnCount > 0) startListening();
      });
    }
  }, [currentQuestion, mode]);

  // Reset resuming flag when session is brand new
  useEffect(() => {
    if (sessionMeta.turnCount === 0) setIsResuming(false);
  }, [sessionMeta.turnCount]);

  // Auto-submit on voice silence
  useEffect(() => {
    if (mode === 'conversation' && sessionMeta.turnCount > 0 && isListening && transcript.trim().length >= 4) {
      const timeout = setTimeout(() => {
        stopListening();
        handleUserSubmit('auto');
      }, 2200);
      return () => clearTimeout(timeout);
    }
  }, [transcript, isListening, mode, sessionMeta.turnCount]);

  // Connection error recovery via voice
  useEffect(() => {
    if (connectionError && isListening) {
      const norm = transcript.toLowerCase().trim();
      if (norm.includes('ok') || norm.includes('está bem') || norm.includes('esta bem')) {
        stopListening();
        recoverFromConnectionError();
      }
    }
  }, [transcript, isListening, connectionError]);

  const recoverFromConnectionError = () => {
    if (!connectionError) return;
    const { failedText, failedIntent } = connectionError;
    setConnectionError(null);
    handleUserSubmit(failedIntent, failedText);
  };

  // ─── Core Submit ─────────────────────────────────────────────────────────────
  const handleUserSubmit = useCallback(async (rawIntent: UserIntent | 'auto' = 'auto', overrideText?: string) => {
    stopListening();
    stopTTS();
    const isVoiceTurn = mode === 'conversation' && rawIntent === 'auto';
    const finalUserText = overrideText || (isVoiceTurn ? transcript : inputText);
    if (!finalUserText.trim() && rawIntent === 'auto') return;

    setIsProcessing(true);
    const state = useSessionStore.getState();
    const textToClassify = rawIntent === 'auto' ? finalUserText : String(rawIntent);
    const intent: UserIntent = rawIntent !== 'auto' ? (rawIntent as UserIntent) : InputClassifier.classify(textToClassify);
    const nextMove = ConductorEngine.decideNextMove(state, intent);

    const requestId = crypto.randomUUID();

    let response;
    try {
      const payload = {
        internalState: state,
        userResponse: finalUserText,
        userIntent: intent,
        forcedNextMove: nextMove,
        inputType: mode === 'conversation' ? (transcript !== finalUserText ? 'corrected_transcript' : 'transcribed') : 'typed'
      };

      const apiReq = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
        body: JSON.stringify(payload)
      });

      if (!apiReq.ok) {
        let errorStr = apiReq.statusText;
        try { const b = await apiReq.json(); if (b?.error) errorStr = b.error; } catch (_) {}
        throw new Error(errorStr);
      }
      response = await apiReq.json();
    } catch (e: any) {
      setConnectionError({ failedText: finalUserText, failedIntent: intent, errorMessage: e?.message });
      setIsProcessing(false);
      return;
    }

    // Merge state via StateUpdater
    const stateUpdates = StateUpdater.enrich(state, intent, response);
    const updatedHistory = [
      ...state.transcriptHistory,
      { role: 'human' as const, text: finalUserText },
      { role: 'ai' as const, text: response.userFacingText }
    ];

    updateState({ ...stateUpdates, transcriptHistory: updatedHistory });
    setCurrentQuestion(response.userFacingText);
    setLastMoveType(response.nextMoveType || nextMove);
    setInputText('');
    manualSetTranscript('');
    setShowTranscriptInput(false);
    incrementTurn();
    setIsProcessing(false);
  }, [mode, transcript, inputText, stopListening, stopTTS, updateState, incrementTurn, manualSetTranscript]);

  // ─── Chip click handler ───────────────────────────────────────────────────────
  const handleChipClick = (chipText: string) => {
    stopListening();
    manualSetTranscript(chipText);
    handleUserSubmit('substantive', chipText);
  };

  // ─── Session Start ────────────────────────────────────────────────────────────
  const startSession = (selectedMode: 'conversation' | 'writing') => {
    setMode(selectedMode);
    // Trigger the first question: ask_field
    handleUserSubmitFirstTurn(selectedMode);
  };

  const handleUserSubmitFirstTurn = async (selectedMode: 'conversation' | 'writing') => {
    setIsProcessing(true);
    const state = useSessionStore.getState();
    const requestId = crypto.randomUUID();
    const nextMove = 'ask_field';

    try {
      const payload = {
        internalState: { ...state, mode: selectedMode, phase: 'FIELD' },
        userResponse: '',
        userIntent: 'substantive',
        forcedNextMove: nextMove,
        inputType: selectedMode === 'conversation' ? 'transcribed' : 'typed'
      };
      const apiReq = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
        body: JSON.stringify(payload)
      });
      if (!apiReq.ok) throw new Error(apiReq.statusText);
      const response = await apiReq.json();
      updateState({ phase: 'FIELD', mode: selectedMode });
      setCurrentQuestion(response.userFacingText);
      setLastMoveType(response.nextMoveType || nextMove);
    } catch (e: any) {
      // Fallback: use static template from spec
      updateState({ phase: 'FIELD', mode: selectedMode });
      setCurrentQuestion('Isto pesa-te mais em que zona?');
      setLastMoveType('ask_field');
    }
    setIsProcessing(false);
  };

  const state = useSessionStore.getState();

  // ─── Render: SESSION_INIT (Splash) ────────────────────────────────────────────
  if (phase === 'SESSION_INIT') {
    return (
      <div className="container">
        <div className="splash">
          <h1>_introspect_AI</h1>
          <p>
            Localiza o que pesa. Percebe o que o mantém. Recebe orientação concreta.<br />
            Como preferes avançar hoje?
          </p>
          <div className="splash-actions">
            <button onClick={() => startSession('conversation')} className="splash-btn btn-outline" disabled={isProcessing}>
              {isProcessing ? 'A preparar...' : 'Falar (Voz)'}
            </button>
            <button onClick={() => startSession('writing')} className="splash-btn btn-ghost" disabled={isProcessing}>
              {isProcessing ? 'A preparar...' : 'Prefiro Escrever'}
            </button>
          </div>
          <div style={{ marginTop: '32px', fontSize: '0.75rem', color: '#cbd5e1' }}>
            {useSessionStore.getState().appVersion}
          </div>
        </div>
        {!import.meta.env.PROD && <DebugPanel />}
      </div>
    );
  }

  // ─── Render: RESUME_CHECK ─────────────────────────────────────────────────────
  if (phase === 'RESUME_CHECK' && isResuming && sessionMeta.turnCount > 0) {
    const prior = state.continuityMemory;
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, width: '100%', padding: '0 24px' }}>
          <h2 style={{ marginBottom: 16 }}>Sessão anterior</h2>
          {prior.priorLatentHypothesis && (
            <div style={{ background: 'var(--accent-base)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, marginBottom: 24, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              {prior.priorLatentHypothesis}
            </div>
          )}
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
            Da última vez ficou uma hipótese aberta. Queres continuar daí, corrigir a base, ou começar de outro ângulo?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn-primary" onClick={() => { updateState({ phase: 'CONTINUATION_MODE_SELECT' }); setIsResuming(false); }}>
              Continuar daí
            </button>
            <button className="btn-secondary" onClick={() => { updateState({ phase: 'FIELD' }); setIsResuming(false); handleUserSubmitFirstTurn(mode); }}>
              Começar de outro ângulo
            </button>
            <button className="btn-secondary" onClick={() => { resetSession(); setIsResuming(false); }}>
              Limpar e começar do zero
            </button>
          </div>
        </div>
        {!import.meta.env.PROD && <DebugPanel />}
      </div>
    );
  }

  // ─── Render: CLOSE ────────────────────────────────────────────────────────────
  if (phase === 'CLOSE') {
    return (
      <div className="container" style={{ padding: '0 2rem' }}>
        <div className="splash" style={{ maxWidth: 600 }}>
          <h1 style={{ marginBottom: '0.5rem', fontSize: '1.4rem' }}>Leitura</h1>
          {latentModel.latentHypothesis && (
            <div style={{ textAlign: 'left', background: 'var(--accent-base)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 24 }}>
              {latentModel.latentHypothesis}
            </div>
          )}
          {(guidanceModel.repositioningFrame || guidanceModel.microStep) && (
            <div style={{ textAlign: 'left', borderRadius: 12, padding: '0 4px', marginBottom: 24 }}>
              {guidanceModel.repositioningFrame && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: 6, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reposicionamento</strong>
                  <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>{guidanceModel.repositioningFrame}</p>
                </div>
              )}
              {guidanceModel.keyDistinction && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: 6, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distinção</strong>
                  <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>{guidanceModel.keyDistinction}</p>
                </div>
              )}
              {guidanceModel.microStep && (
                <div style={{ background: 'var(--accent-base)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: 6, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Micro-passo</strong>
                  <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>{guidanceModel.microStep}</p>
                </div>
              )}
            </div>
          )}
          <PostSessionFeedback onComplete={(feedback) => console.log('Feedback Final:', feedback)} />
          <button onClick={resetSession} className="btn-secondary" style={{ marginTop: 20 }}>
            Nova Sessão
          </button>
        </div>
        {!import.meta.env.PROD && <DebugPanel />}
      </div>
    );
  }

  // ─── Render: Connection Error ─────────────────────────────────────────────────
  if (connectionError) {
    return (
      <div className="app-container" style={{ padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ padding: '24px', background: '#fee2e2', borderRadius: '12px', color: '#b91c1c', width: '100%', marginBottom: '32px', border: '1px solid #fca5a5' }}>
            <strong style={{ fontSize: '1.1rem', display: 'block', marginBottom: '10px' }}>Falha na Ligação</strong>
            <span style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
              {connectionError.errorMessage?.includes('OPENAI_API_KEY')
                ? 'Motor não configurado (API Key em falta).'
                : 'Não foi possível contactar o motor. O teu progresso está preservado.'}
            </span>
          </div>
          <button onClick={recoverFromConnectionError} className="btn-primary" style={{ marginBottom: '16px', width: '100%' }}>
            Tentar de novo
          </button>
          <button onClick={resetSession} className="btn-secondary" style={{ width: '100%' }}>
            Recomeçar
          </button>
        </div>
      </div>
    );
  }

  // ─── Determinar se estamos numa fase de chips ─────────────────────────────────
  const activeChips = CHIP_PHASES.has(phase) ? (CHIPS_BY_PHASE[phase] ?? []) : [];
  const isChipPhase = activeChips.length > 0;

  // ─── Render Principal: Conversa ───────────────────────────────────────────────
  return (
    <div className="app-container" style={{ padding: '0 2rem' }}>
      <div className="session-wrapper">
        <div className="topbar">
          <span>_introspect</span>
          <span>Turno {sessionMeta.turnCount} • {mode === 'writing' ? 'Escrever' : 'Voz'} • {phase}</span>
        </div>

        <div className="content-area">
          <h2 className="question-text">
            {currentQuestion || (isProcessing ? 'A preparar...' : '')}
          </h2>

          {/* ── CHIPS (fases FIELD / NATURE / FUNCTION / COST) ── */}
          {isChipPhase && (
            <div style={{ marginTop: 32 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: mode === 'conversation' ? 'center' : 'flex-start' }}>
                {activeChips.map(chip => (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    disabled={isProcessing}
                    style={{
                      padding: '10px 18px',
                      background: 'var(--accent-base, #1e293b)',
                      color: 'var(--text-main, #f1f5f9)',
                      border: '1px solid var(--border-color, #334155)',
                      borderRadius: '24px',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      fontSize: '0.88rem',
                      lineHeight: 1.4,
                      transition: 'all 0.15s ease',
                      opacity: isProcessing ? 0.5 : 1
                    }}
                    onMouseEnter={e => { if (!isProcessing) (e.target as HTMLElement).style.borderColor = '#94a3b8'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-color, #334155)'; }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              {/* Permitir alternativa de texto livre mesmo nas fases de chips */}
              {mode === 'writing' && (
                <div style={{ marginTop: 20 }}>
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserSubmit('auto'); } }}
                    placeholder="Ou descreve com as tuas palavras..."
                    disabled={isProcessing}
                    style={{ fontSize: '0.9rem', minHeight: 60 }}
                  />
                  {inputText.trim() && (
                    <div className="controls" style={{ marginTop: 12 }}>
                      <button onClick={() => handleUserSubmit('auto')} disabled={isProcessing} className="btn-primary">
                        {isProcessing ? 'A processar...' : 'Continuar'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── INPUT ZONE (fases sem chips) ── */}
          {!isChipPhase && (
            <div className="input-area">
              {mode === 'writing' ? (
                <textarea
                  autoFocus
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserSubmit('auto'); } }}
                  placeholder="A tua resposta..."
                  disabled={isProcessing}
                />
              ) : (
                <div className="audio-live-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
                  {!isSupported && <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>Microfone indisponível.</div>}

                  {isSpeaking && (
                    <button onClick={stopTTS} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b', padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      Pausar ◼
                    </button>
                  )}

                  <div style={{ padding: '32px 0' }}>
                    <button
                      onClick={toggleListening}
                      disabled={!isSupported || isProcessing || isSpeaking}
                      style={{
                        width: 100, height: 100, borderRadius: '50%',
                        border: isListening ? '6px solid #fecaca' : 'none',
                        background: isProcessing ? '#fbbf24' : isListening ? '#ef4444' : isSpeaking ? '#3b82f6' : '#0f172a',
                        color: '#fff', cursor: (!isSupported || isSpeaking || isProcessing) ? 'not-allowed' : 'pointer',
                        boxShadow: isListening ? '0 0 24px rgba(239,68,68,0.4)' : isProcessing ? '0 0 24px rgba(251,191,36,0.4)' : 'none',
                        transition: '0.2s all', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <span style={{ fontSize: '2rem' }}>{isProcessing ? '⏳' : isSpeaking ? '🔊' : '🎙️'}</span>
                    </button>
                    <div style={{ textAlign: 'center', marginTop: 16, color: isProcessing ? '#d97706' : isListening ? '#ef4444' : isSpeaking ? '#2563eb' : '#64748b', fontWeight: (isListening || isSpeaking || isProcessing) ? 'bold' : 'normal' }}>
                      {isProcessing ? 'A processar...' : isSpeaking ? 'A falar...' : isListening ? 'Estou a ouvir...' : 'Toca para Falar'}
                    </div>
                    {sttError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{sttError}</div>}
                  </div>

                  {transcript && (
                    <div style={{ width: '100%', background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontStyle: 'italic' }}>"{transcript}"</p>
                      {!showTranscriptInput && (
                        <div style={{ textAlign: 'right', marginTop: 8 }}>
                          <button onClick={() => setShowTranscriptInput(true)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}>
                            Corrigir texto
                          </button>
                        </div>
                      )}
                      {showTranscriptInput && (
                        <textarea value={transcript} onChange={e => manualSetTranscript(e.target.value)} disabled={isProcessing || isListening} style={{ minHeight: 60, marginTop: 12, fontSize: '0.85rem' }} />
                      )}
                    </div>
                  )}

                  {/* Chips de fricção */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: 12 }}>
                    <button onClick={() => { stopListening(); handleUserSubmit('simplify_request'); }} disabled={isProcessing || isSpeaking} style={{ padding: '8px 16px', background: '#ffe4e6', color: '#be123c', border: 'none', borderRadius: 24, cursor: 'pointer', fontSize: '0.85rem' }}>
                      Explica-me melhor
                    </button>
                    <button onClick={() => { stopListening(); handleUserSubmit('dont_know'); }} disabled={isProcessing || isSpeaking} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 24, cursor: 'pointer', fontSize: '0.85rem' }}>
                      Não sei
                    </button>
                  </div>
                </div>
              )}

              {mode === 'writing' && (
                <>
                  <div className="controls">
                    <div className="secondary-actions">
                      <button onClick={() => handleUserSubmit('dont_know')} disabled={isProcessing} className="btn-secondary">Não sei</button>
                      <button onClick={() => handleUserSubmit('not_me_request')} disabled={isProcessing} className="btn-secondary">Não é bem isso</button>
                      <button onClick={() => handleUserSubmit('simplify_request')} disabled={isProcessing} className="btn-secondary">Explica melhor</button>
                    </div>
                  </div>
                  <div className="controls" style={{ marginTop: 24 }}>
                    <button
                      onClick={() => handleUserSubmit('auto')}
                      disabled={isProcessing || !inputText.trim()}
                      className="btn-primary"
                    >
                      {isProcessing ? 'A processar...' : 'Continuar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {!import.meta.env.PROD && <DebugPanel />}
    </div>
  );
}
