import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { ConductorEngine } from '../engine/conductor';
import { StateUpdater } from '../engine/updateState';
import { InputClassifier } from '../engine/classifyInput';
import type { UserIntent } from '../engine/classifyInput';
import { OutcomeEngine } from '../engine/outcomeRules';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useTTS } from '../hooks/useTTS';
import { ResumeCard } from '../features/session/ResumeCard';
import { PostSessionFeedback } from '../features/feedback/PostSessionFeedback';
import { OnboardingWizard } from '../features/session/OnboardingWizard';
import { DebugPanel } from '../dev/DebugPanel';
import './index.css';

export default function App() {
  const { mode, setMode, phase, turnIndex, updateState, incrementTurn, resetSession } = useSessionStore();
  const { isListening, transcript, toggleListening, startListening, stopListening, manualSetTranscript, error: sttError, isSupported } = useSpeechInput();
  const { speak, stop: stopTTS, isSpeaking } = useTTS();
  
  const [currentQuestion, setCurrentQuestion] = useState("Vou precisar que fales comigo.");
  const [lastMoveType, setLastMoveType] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionError, setConnectionError] = useState<{ failedText: string, failedIntent: UserIntent | 'auto', errorMessage?: string } | null>(null);
  
  // Only start in a resuming state if we ACTUALLY mount with an existing active session > 0
  const [isResuming, setIsResuming] = useState(() => useSessionStore.getState().turnIndex > 0);
  const [showTranscriptInput, setShowTranscriptInput] = useState(false);

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
      console.log('[System Recovery] Resuming failed context transmission...');
      const { failedText, failedIntent } = connectionError;
      setConnectionError(null);
      handleUserSubmit(failedIntent, failedText);
  };

  // Guarantee that starting a brand new session mathematically clears the resumption block 
  // preventing it from mistakenly triggering after onboarding steps
  useEffect(() => {
     if (turnIndex === 0) {
        setIsResuming(false);
     }
  }, [turnIndex]);

  // Trigger TTS on new question if conversation mode
  useEffect(() => {
     if (mode === 'conversation' && currentQuestion) {
        speak(currentQuestion, () => {
           // Auto-start listening ONLY if we are past the onboarding wizard
           if (turnIndex > 0) {
              startListening();
           }
        });
     }
  }, [currentQuestion, mode, speak, turnIndex, startListening]);

  // Handle Silence Auto-Submit ONLY for main conversation flow, not onboarding
  useEffect(() => {
     if (mode === 'conversation' && turnIndex > 0 && isListening && transcript.trim().length >= 4) {
        const timeout = setTimeout(() => {
           // Silence reached during listening, auto submit phrase!
           stopListening();
           handleUserSubmit('auto');
        }, 2200);
        return () => clearTimeout(timeout);
     }
  }, [transcript, isListening, mode, turnIndex]);

  const startSession = (selectedMode: 'conversation' | 'writing') => {
    setMode(selectedMode);
    updateState({ phase: 'micro_triage' });
  };

  const handleUserSubmit = async (rawIntent: UserIntent | 'auto' = 'auto', overrideText?: string) => {
    stopListening();
    stopTTS(); // Protects manual route against active voice overlap during turn changes
    const isVoiceTurn = mode === 'conversation' && rawIntent === 'auto';
    const finalUserText = overrideText || (isVoiceTurn ? transcript : inputText);

    if (!finalUserText.trim() && rawIntent === 'auto') return;
    
    setIsProcessing(true);
    const state = useSessionStore.getState();

    // 1. Classify
    const textToClassify = rawIntent === 'auto' ? finalUserText : String(rawIntent);
    const intent = rawIntent !== 'auto' ? rawIntent : InputClassifier.classify(textToClassify);
    
    // 2. Conductor decides next move
    const nextMove = ConductorEngine.decideNextMove(state, intent as any);
    
    const requestId = crypto.randomUUID();
    console.log(`[Frontend Submit] Request ID: ${requestId} | Phase: ${state.phase} | Turn: ${state.turnIndex}`);
    
    // 3. Ask LLM live Endpoint via local server boundary
    let response;
    try {
      const payloadShape = {
         internalState: state,
         userResponse: finalUserText,
         userIntent: intent,
         forcedNextMove: nextMove,
         inputType: mode === 'conversation' ? (transcript !== finalUserText ? 'corrected_transcript' : 'transcribed') : 'typed'
      };
      console.log(`[Frontend Submit] ID: ${requestId} | Payload Build OK. Sending to Backend...`, { hasState: !!payloadShape.internalState, textLen: payloadShape.userResponse.length, move: payloadShape.forcedNextMove });
      
      const apiReq = await fetch('/api/llm', {
         method: 'POST',
         headers: { 
             'Content-Type': 'application/json',
             'X-Request-ID': requestId 
         },
         body: JSON.stringify(payloadShape)
      });
      
      if (!apiReq.ok) {
         let errorStr = apiReq.statusText;
         try {
            const errBody = await apiReq.json();
            if (errBody && errBody.error) errorStr = errBody.error;
         } catch(ignored) {}
         console.error(`[Frontend Submit] ID: ${requestId} | Native API Error Status: ${apiReq.status} | Detailed: ${errorStr}`);
         throw new Error(errorStr);
      }
      
      response = await apiReq.json();
      console.log(`[Frontend Submit] ID: ${requestId} | Response OK.`);
    } catch (e: any) {
      console.error(`[Frontend Submit] API Loop Failure | ID: ${requestId} | Error:`, e);
      stopListening();
      stopTTS();
      // Store the specific error so UI can adapt
      setConnectionError({ failedText: finalUserText, failedIntent: intent as any, errorMessage: e?.message });
      setIsProcessing(false);
      return; 
    }
    
    // 4. Update the real state and commit transcript block
    const updatedHistory = [...state.transcriptHistory, 
       { role: 'human', text: finalUserText },
       { role: 'ai', text: response.userFacingText }
    ];
    
    // @ts-ignore
    const stateUpdates = StateUpdater.enrich(state, intent as any, response);
    updateState({ ...stateUpdates, transcriptHistory: updatedHistory as any });
    
    // 5. Update UI
    setCurrentQuestion(response.userFacingText);
    setLastMoveType(response.nextMoveType || nextMove);
    setInputText("");
    manualSetTranscript(""); // Reseta a transcrição após o envio
    setShowTranscriptInput(false);
    incrementTurn();
    setIsProcessing(false);
  };

  const handleInterruptSpeaking = () => {
     stopTTS();
  };

  const state = useSessionStore.getState();
  
  if (phase === 'opening') {
    return (
      <div className="container">
        <div className="splash">
          <h1>_introspect_AI</h1>
          <p>
            Um espaço focado para perceber o que pesa. <br/>
            Como preferes avançar hoje?
          </p>
          <div className="splash-actions">
            <button onClick={() => startSession('conversation')} className="splash-btn btn-outline">
              Falar (Voz)
            </button>
            <button onClick={() => startSession('writing')} className="splash-btn btn-ghost">
              Prefiro Escrever
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

  if (phase === 'outcome_delivered') {
    const outcome = OutcomeEngine.calculateOutcome(state);
    return (
      <div className="container" style={{ padding: '0 2rem' }}>
        <div className="splash" style={{ maxWidth: 600 }}>
          <h1 style={{ marginBottom: '2rem' }}>A Tua Leitura (Nível {outcome.level})</h1>
          <div style={{ textAlign: 'left', background: 'var(--accent-base)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
             {Object.entries(outcome.payload).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 12 }}>
                   <strong style={{color: 'var(--text-main)', textTransform: 'capitalize'}}>{k.replace(/([A-Z])/g, ' $1')}:</strong><br/>
                   {v}
                </div>
             ))}
          </div>
          <button onClick={() => useSessionStore.getState().resetSession()} className="btn-primary" style={{ marginTop: 32 }}>Nova Sessão</button>
        </div>
        {!import.meta.env.PROD && <DebugPanel />}
      </div>
    );
  }

  const handleExportEcosystem = () => {
    const ecosystemProfile = {
       wearLevel: { intensity: 'high', confidence: 'moderate', temporality: 'persistent', origin: 'inferido por fadiga estrutural' }
       // Simulated for MVP output
    };
    alert('Mock Request Emitido: A gerar integração segura via Profile Ecosystem.');
    console.log('[Ablute Ecosystem Handoff] Payload Export:', ecosystemProfile);
  };

  // ERROR STATE OVERRIDE (Must be highest priority to prevent silent crashes in Turn 0)
  if (connectionError) {
      return (
         <div className="app-container" style={{ padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '400px', width: '100%' }}>
               <div style={{ padding: '24px', background: '#fee2e2', borderRadius: '12px', color: '#b91c1c', width: '100%', marginBottom: '32px', border: '1px solid #fca5a5', boxShadow: '0 8px 16px rgba(185, 28, 28, 0.1)' }}>
                  <strong style={{ fontSize: '1.2rem', display: 'block', marginBottom: '12px' }}>Falha na Ligação</strong>
                  <span style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                     {connectionError.errorMessage?.includes('OPENAI_API_KEY') 
                       ? "A produção ainda não está ligada ao motor real. (OPENAI_API_KEY em falta)" 
                       : "Não foi possível contactar o motor. Não te preocupes, o teu progresso exato está preservado localmente."}
                  </span>
               </div>
               <button onClick={() => recoverFromConnectionError()} className="btn-primary" style={{ marginBottom: '32px', background: '#ef4444', padding: '16px 32px', fontSize: '1.1rem', width: '100%' }}>
                  Tentar de novo
               </button>
               {mode === 'conversation' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                     <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>Também podes tocar abaixo e dizer "ok"</div>
                     <button 
                       onClick={toggleListening} 
                       disabled={!isSupported || isProcessing}
                       style={{
                          width: '80px', height: '80px', borderRadius: '50%', 
                          background: isListening ? '#ef4444' : '#0f172a',
                          color: '#fff', border: 'none', cursor: 'pointer',
                          fontSize: '1.8rem', boxShadow: isListening ? '0 0 24px rgba(239,68,68,0.5)' : 'none',
                          transition: '0.2s all'
                       }}
                     >
                        🎙️
                     </button>
                     {isListening && <div style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '12px', fontWeight: 'bold' }}>Estou a ouvir...</div>}
                  </div>
               )}
            </div>
         </div>
      );
  }

  // INTERCEPT START
  if (isResuming && turnIndex > 0 && (phase as string) !== 'outcome_delivered') {
      return (
         <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResumeCard 
              onResume={() => setIsResuming(false)} 
              onReset={() => {
                resetSession();
                setIsResuming(false);
              }}
            />
            {!import.meta.env.PROD && (
               <>
                  <h4>Resultado Preliminar (Dev Mode):</h4>
                  <pre style={{ fontSize: '0.8em', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(OutcomeEngine.calculateOutcome(state).payload, null, 2)}
                  </pre>
               </>
            )}
         </div>
      );
  }

  if (turnIndex === 0 && phase === 'micro_triage') {
      return (
         <div className="app-container">
            <OnboardingWizard 
               mode={mode} 
               isProcessing={isProcessing}
               onComplete={(stitchedTranscript) => {
                  handleUserSubmit('auto', stitchedTranscript);
               }} 
            />
            {!import.meta.env.PROD && <DebugPanel />}
         </div>
      );
  }

  return (
    <div className="app-container" style={{ padding: '0 2rem' }}>
      <div className="session-wrapper">
        <div className="topbar">
          <span>_introspect</span>
          <span>Turno {turnIndex} • {mode === 'writing' ? 'Escrever' : 'Voz'}</span>
        </div>

        <div className="content-area">
          <h2 className="question-text">
            {currentQuestion}
          </h2>

          <div className="input-area">
            {mode === 'writing' ? (
              <textarea
                autoFocus
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleUserSubmit('auto');
                  }
                }}
                placeholder="A tua resposta..."
                disabled={isProcessing}
              />
            ) : (
              <div className="audio-live-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
                {!isSupported && <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>Aviso: Microfone indisponível. Recorrendo apenas aos botões e reencaminhando fluxo.</div>}
                
                {isSpeaking && (
                   <button onClick={handleInterruptSpeaking} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b', padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      Pausar leitura de IA ◼
                   </button>
                )}
                <div style={{ padding: '32px 0' }}>
                   <button 
                     onClick={toggleListening} 
                     disabled={!isSupported || isProcessing || isSpeaking}
                     style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%', 
                        border: isListening ? '6px solid #fecaca' : 'none', 
                        background: isProcessing ? '#fbbf24' : isListening ? '#ef4444' : isSpeaking ? '#3b82f6' : '#0f172a',
                        color: '#fff',
                        cursor: (isSupported && !isSpeaking && !isProcessing) ? 'pointer' : 'not-allowed',
                        boxShadow: isListening ? '0 0 24px rgba(239, 68, 68, 0.4)' : isProcessing ? '0 0 24px rgba(251, 191, 36, 0.4)' : isSpeaking ? '0 0 24px rgba(59, 130, 246, 0.4)' : '0 8px 16px rgba(15, 23, 42, 0.2)',
                        transition: '0.2s all',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                     }}
                   >
                     <span style={{ fontSize: '2rem' }}>
                        {isProcessing ? '⏳' : isSpeaking ? '🔊' : '🎙️'}
                     </span>
                   </button>
                   <div style={{ textAlign: 'center', marginTop: '16px', color: isProcessing ? '#d97706' : isListening ? '#ef4444' : isSpeaking ? '#2563eb' : '#64748b', fontWeight: (isListening || isSpeaking || isProcessing) ? 'bold' : 'normal' }}>
                      {isProcessing ? 'A processar...' : isSpeaking ? 'A falar...' : isListening ? 'Estou a ouvir...' : 'Toca para Falar'}
                   </div>
                   {isListening && transcript.trim().length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4, fontStyle: 'italic', textAlign: 'center' }}>
                         (Irá enviar automaticamente se houver pausa)
                      </div>
                   )}
                   {sttError && <div style={{color: '#ef4444', fontSize: 12, marginTop: 8, textAlign:'center'}}>{sttError}</div>}
                 </div>
                
                {/* Visual support and manual edit toggle */}
                {transcript && (
                   <div style={{ width: '100%', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontStyle: 'italic' }}>"{transcript}"</p>
                      {!showTranscriptInput && (
                         <div style={{ textAlign: 'right', marginTop: '8px' }}>
                            <button onClick={() => setShowTranscriptInput(true)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}>
                               Corrigir texto transcrito
                            </button>
                         </div>
                      )}
                      
                      {showTranscriptInput && (
                         <textarea
                           value={transcript}
                           onChange={(e) => manualSetTranscript(e.target.value)}
                           disabled={isProcessing || isListening}
                           style={{ minHeight: 60, marginTop: '12px', fontSize: '0.85rem' }}
                         />
                      )}
                   </div>
                )}
                
                {/* Voice-First Chips Sub-Layer */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: '12px' }}>
                    {/* Hide Sim/Não generically when engine actively asks an open-text inquiry */}
                    {!(lastMoveType?.startsWith('ask_')) && ['Sim', 'Não', 'Mais ou menos'].map(txt => (
                       <button key={txt} onClick={() => { stopListening(); manualSetTranscript(txt); handleUserSubmit('substantive'); }} disabled={isProcessing || isSpeaking} style={{ padding: '8px 16px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '24px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          {txt}
                       </button>
                    ))}
                    <button onClick={() => { stopListening(); handleUserSubmit('simplify_request'); }} disabled={isProcessing || isSpeaking} style={{ padding: '8px 16px', background: '#ffe4e6', color: '#be123c', border: 'none', borderRadius: '24px', cursor: 'pointer', fontSize: '0.85rem' }}>
                       Explica-me melhor
                    </button>
                    <button onClick={() => { stopListening(); handleUserSubmit('dont_know'); }} disabled={isProcessing || isSpeaking} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '24px', cursor: 'pointer', fontSize: '0.85rem' }}>
                       Não sei
                    </button>
                </div>
              </div>
            )}

            {mode === 'writing' && !connectionError && (
              <div className="controls">
                <div className="secondary-actions">
                  <button onClick={() => handleUserSubmit('dont_know')} disabled={isProcessing} className="btn-secondary">Não sei</button>
                  <button onClick={() => handleUserSubmit('not_me_request')} disabled={isProcessing} className="btn-secondary">Não é bem isso</button>
                  <button onClick={() => handleUserSubmit('simplify_request')} disabled={isProcessing} className="btn-secondary">Explica melhor</button>
                </div>
              </div>
            )}

            {mode === 'writing' && !connectionError && (
              <div className="controls" style={{ marginTop: '24px' }}>
                <button 
                  onClick={() => {
                    if (state.phase === 'closure_ready') {
                       updateState({ phase: 'outcome_delivered' });
                    } else {
                       handleUserSubmit('auto');
                    }
                  }}
                  disabled={isProcessing || (mode === 'writing' && !inputText.trim() && state.phase !== 'closure_ready')}
                  className="btn-primary"
                >
                  {state.phase === 'closure_ready' ? 'Ver Leitura Final' : isProcessing ? 'A processar...' : 'Continuar'}
                </button>
              </div>
            )}
            
            {(mode === 'conversation' && state.phase === 'closure_ready') && (
              <div className="controls" style={{ marginTop: '24px' }}>
                <button onClick={() => updateState({ phase: 'outcome_delivered' })} className="btn-primary" style={{ width: '100%' }}>
                   Ver Leitura Final
                </button>
              </div>
            )}
            
            {((phase as string) === 'outcome_delivered') && (
               <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <button onClick={handleExportEcosystem} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                     Exportar Leitura Interna (Ecossistema)
                  </button>
                  <button onClick={resetSession} style={{ padding: '8px 16px', background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', marginLeft: '12px' }}>
                     Limpar Sessão
                  </button>
                  <PostSessionFeedback onComplete={(feedback) => console.log('Feedback Final:', feedback)} />
               </div>
            )}
          </div>
        </div>
      </div>
      {!import.meta.env.PROD && <DebugPanel />}
    </div>
  );
}
