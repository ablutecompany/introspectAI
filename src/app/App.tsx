import { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { ConductorEngine } from '../engine/conductor';
import { askLLM } from '../../server/llm/client';
import './index.css';

export default function App() {
  const { mode, setMode, phase, turnIndex, updateState, incrementTurn } = useSessionStore();
  const state = useSessionStore.getState();
  
  const [currentQuestion, setCurrentQuestion] = useState("Como te sentes hoje? (Escolhe falar ou escrever)");
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const startSession = (selectedMode: 'conversation' | 'writing') => {
    setMode(selectedMode);
    updateState({ phase: 'micro_triage' });
    setCurrentQuestion("O que te trouxe aqui hoje? Onde sentes que está o peso maior?");
  };

  const handleUserSubmit = async (intent: 'vague' | 'deflective' | 'substantive' | 'dont_know' = 'substantive') => {
    if (!inputText.trim() && intent === 'substantive') return;
    
    setIsProcessing(true);
    
    // 1. Conductor decides next move type based on current state & intent
    const nextMove = ConductorEngine.decideNextMove(state, intent);
    
    // 2. Ask LLM Mock
    const response = await askLLM({
      internalState: state,
      userResponse: inputText,
      userIntent: intent,
      forcedNextMove: nextMove
    });
    
    // 3. Update the state
    updateState({
      costSignals: [...state.costSignals, ...(response.extractedSignals.costs || [])],
      confidenceLevel: response.suggestedUpdates.confidenceHint,
    });
    
    // 4. Update UI
    setCurrentQuestion(response.userFacingText);
    setInputText("");
    incrementTurn();
    setIsProcessing(false);
  };

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
                    handleUserSubmit('substantive');
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
                  Não sei responder
                </button>
                <button 
                  onClick={() => handleUserSubmit('vague')}
                  disabled={isProcessing}
                  className="btn-secondary"
                >
                  Não é bem isso
                </button>
              </div>

              <button 
                onClick={() => handleUserSubmit('substantive')}
                disabled={isProcessing || (!inputText.trim() && mode === 'writing')}
                className="btn-primary"
              >
                {isProcessing ? '...' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
