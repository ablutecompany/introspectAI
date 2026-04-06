import { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { ConductorEngine } from '../engine/conductor';
import { StateUpdater } from '../engine/updateState';
import { InputClassifier, UserIntent } from '../engine/classifyInput';
import { OutcomeEngine } from '../engine/outcomeRules';
import { askLLM } from '../../server/llm/client';
import { DebugPanel } from '../dev/DebugPanel';
import './index.css';

export default function App() {
  const { mode, setMode, phase, turnIndex, updateState, incrementTurn } = useSessionStore();
  
  const [currentQuestion, setCurrentQuestion] = useState("O que te trouxe aqui hoje? Onde sentes que está o peso maior?");
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const startSession = (selectedMode: 'conversation' | 'writing') => {
    setMode(selectedMode);
    updateState({ phase: 'micro_triage' });
  };

  const handleUserSubmit = async (rawIntent: UserIntent | 'auto' = 'auto') => {
    if (!inputText.trim() && rawIntent === 'auto') return;
    
    setIsProcessing(true);
    const state = useSessionStore.getState();

    // 1. Classify
    const textToClassify = rawIntent === 'auto' ? inputText : String(rawIntent);
    const intent = rawIntent !== 'auto' ? rawIntent : InputClassifier.classify(textToClassify);
    
    // 2. Conductor decides next move
    const nextMove = ConductorEngine.decideNextMove(state, intent);
    
    // 3. Ask LLM Mock
    const response = await askLLM({
      internalState: state,
      userResponse: inputText,
      userIntent: intent,
      forcedNextMove: nextMove
    });
    
    // 4. Update the real state
    const stateUpdates = StateUpdater.enrich(state, intent, response);
    updateState(stateUpdates);
    
    // 5. Update UI
    setCurrentQuestion(response.userFacingText);
    setInputText("");
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

  return (
    <div className="container" style={{ padding: '0 2rem' }}>
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
              <div className="audio-mock">
                [Modo Voz: Interface de Escuta Ativa (Mock)]
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
                disabled={isProcessing || (!inputText.trim() && mode === 'writing' && state.phase !== 'closure_ready')}
                className="btn-primary"
              >
                {state.phase === 'closure_ready' ? 'Ver Leitura' : isProcessing ? '...' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <DebugPanel />
    </div>
  );
}
