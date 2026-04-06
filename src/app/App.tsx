import { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { ConductorEngine } from '../engine/conductor';
import { StateUpdater } from '../engine/updateState';
import { InputClassifier } from '../engine/classifyInput';
import type { UserIntent } from '../engine/classifyInput';
import { OutcomeEngine } from '../engine/outcomeRules';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { ResumeCard } from '../features/session/ResumeCard';
import { askLLM } from '../../server/llm/client';
import { DebugPanel } from '../dev/DebugPanel';
import './index.css';

export default function App() {
  const { mode, setMode, phase, turnIndex, updateState, incrementTurn, resetSession } = useSessionStore();
  const { isListening, transcript, toggleListening, manualSetTranscript, error: sttError, isSupported } = useSpeechInput();
  
  const [currentQuestion, setCurrentQuestion] = useState("O que te trouxe aqui hoje? Onde sentes que está o peso maior?");
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResuming, setIsResuming] = useState(true); // Control flow flag for early intercepts

  const startSession = (selectedMode: 'conversation' | 'writing') => {
    setMode(selectedMode);
    updateState({ phase: 'micro_triage' });
  };

  const handleUserSubmit = async (rawIntent: UserIntent | 'auto' = 'auto') => {
    const isVoiceTurn = mode === 'conversation' && rawIntent === 'auto';
    const finalUserText = isVoiceTurn ? transcript : inputText;

    if (!finalUserText.trim() && rawIntent === 'auto') return;
    
    setIsProcessing(true);
    const state = useSessionStore.getState();

    // 1. Classify
    const textToClassify = rawIntent === 'auto' ? finalUserText : String(rawIntent);
    const intent = rawIntent !== 'auto' ? rawIntent : InputClassifier.classify(textToClassify);
    
    // 2. Conductor decides next move
    const nextMove = ConductorEngine.decideNextMove(state, intent as any);
    
    // 3. Ask LLM live Endpoint
    const response = await askLLM({
      internalState: state,
      userResponse: finalUserText,
      userIntent: intent as any,
      forcedNextMove: nextMove,
      inputType: mode === 'conversation' ? (transcript !== finalUserText ? 'corrected_transcript' : 'transcribed') : 'typed'
    });
    
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
    setInputText("");
    manualSetTranscript(""); // Reseta a transcrição após o envio
    incrementTurn();
    setIsProcessing(false);
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
        </div>
        <DebugPanel />
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
        <DebugPanel />
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
              <div className="audio-live-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!isSupported && <div style={{ color: '#f00', fontSize: 12 }}>Microfone não suportado pelo browser. Usa Escrita.</div>}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                   <button 
                     onClick={toggleListening} 
                     disabled={!isSupported || isProcessing}
                     style={{
                        padding: '12px 24px', 
                        borderRadius: 30, 
                        border: 'none', 
                        background: isListening ? '#ef4444' : '#fff',
                        color: isListening ? '#fff' : '#000',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: '0.2s all'
                     }}
                   >
                      {isListening ? 'A ouvir... (Clique para parar)' : 'Falar'}
                   </button>
                   {sttError && <span style={{color: '#ef4444', fontSize: 12}}>{sttError}</span>}
                </div>

                {/* Edit STT text directly before submit */}
                <textarea
                  value={transcript}
                  onChange={(e) => manualSetTranscript(e.target.value)}
                  placeholder="A tua voz aparecerá aqui..."
                  disabled={isProcessing || isListening}
                  style={{ minHeight: 80 }}
                />
              </div>
            )}

            <div className="controls">
              <div className="secondary-actions">
                <button 
                  onClick={() => handleUserSubmit('dont_know')}
                  disabled={isProcessing}
                  className="btn-secondary"
                >
                  Não sei
                </button>
                <button 
                  onClick={() => handleUserSubmit('not_me_request')}
                  disabled={isProcessing}
                  className="btn-secondary"
                >
                  Não é bem isso
                </button>
                <button 
                  onClick={() => handleUserSubmit('simplify_request')}
                  disabled={isProcessing}
                  className="btn-secondary"
                >
                  Explica melhor
                </button>
              </div>

              <button 
                onClick={() => {
                  if (state.phase === 'closure_ready') {
                     updateState({ phase: 'outcome_delivered' });
                  } else {
                     handleUserSubmit('auto');
                  }
                }}
                disabled={isProcessing || (mode === 'writing' && !inputText.trim() && state.phase !== 'closure_ready') || (mode === 'conversation' && !transcript.trim() && state.phase !== 'closure_ready')}
                className="btn-primary"
              >
                {state.phase === 'closure_ready' ? 'Ver Leitura' : isProcessing ? '...' : 'Continuar'}
              </button>
            </div>
            
            {((phase as string) === 'outcome_delivered') && (
               <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <button onClick={handleExportEcosystem} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                     Exportar Leitura Interna (Ecossistema)
                  </button>
                  <button onClick={resetSession} style={{ padding: '8px 16px', background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', marginLeft: '12px' }}>
                     Limpar Sessão e Começar de Novo
                  </button>
               </div>
            )}
          </div>
        </div>
      </div>
      <DebugPanel />
    </div>
  );
}
