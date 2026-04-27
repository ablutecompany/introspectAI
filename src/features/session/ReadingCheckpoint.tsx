/**
 * ReadingCheckpoint.tsx
 *
 * Sprint 8: Checkpoint "Isto faz sentido?"
 *
 * Apresentado após a Leitura Emergente. Impede o avanço cego.
 * - Confirmação avança para CONTINUATION_ACTIVE.
 * - Incompreensão aciona motor de clarificação.
 * - Recusa parcial ou total acciona vias de correcção ancoradas.
 */

import React, { useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';

interface Props {
  onProceed: () => void;
}

type CheckpointPhase = 'choice' | 'partial_input' | 'correction_choice' | 'clarification';

export const ReadingCheckpoint: React.FC<Props> = ({ onProceed }) => {
  const [phase, setPhase] = useState<'choice' | 'partial_input'>('choice');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { caseMemory, updateCaseMemory, updateState } = useSessionStore();

  const submitEventToLLM = async (actionType: string, payloadText: string = "") => {
    setIsProcessing(true);
    const stateSnapshot = useSessionStore.getState();

    try {
        const reqPayload = {
            sessionStage: 'CHECKPOINT',
            caseSummary: stateSnapshot.caseMemory.provisionalHypothesis || 'Feedback à leitura',
            currentFocus: stateSnapshot.caseMemory.currentFocus || null,
            currentHypothesis: stateSnapshot.caseMemory.provisionalHypothesis || null,
            lastUserInput: payloadText,
            lastAssistantTurn: 'Isto bate certo com a realidade real?',
            checkpointState: phase,
            conversationDepth: stateSnapshot.caseMemory.progressSignals?.length || 0,
            previousCorrections: [],
            salientTerms: [],
            user_action_type: actionType
        };
        const res = await fetch('/api/conversationTurn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqPayload)
        });

        if (!res.ok) throw new Error('API Error');
        const turnResult = await res.json();

        // Passa o texto do assistente gerado (ex: reformulação ou pedido de desculpa e redirecionamento)
        // para abrir o ecrã Explorar logo a seguir de forma fluida.
        updateState({
            continuationState: {
                ...stateSnapshot.continuationState!,
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
                    mainText: turnResult.assistant_text
                }
            }
        });
    } catch(err) {
        console.warn('LLM API falhou no checkpoint, avançando com fallback mudo', err);
    }
    
    onProceed();
  };

  const handleSim = () => {
    onProceed(); // Avança para Explorar com o texto default ("Por onde queres começar?") definido no App.tsx
  };

  const handleParcialmente = () => setPhase('partial_input');
  
  const handleNaoEBemIsto = () => submitEventToLLM('shortcut_disagreement');
  
  const handleNaoPercebi = () => submitEventToLLM('shortcut_clarification_request');

  const submitPartial = () => {
    if (!inputText.trim()) return;
    submitEventToLLM('shortcut_partial', inputText.trim());
  };

  // ─── Renders ────────────────────────────────────────────────────────────────

  if (phase === 'partial_input') {
    return (
      <div style={containerStyle}>
        <div className="splash" style={splashStyle}>
          <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>O que bate e o que não bate?</h1>
          <p style={{ marginBottom: 24, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            Não te canses a escrever grandes redações. Aponta só o que saltou à vista como estando desalinhado da realidade.
          </p>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing}
            style={{ width: '100%', minHeight: 100, fontSize: '0.95rem', marginBottom: 24 }}
          />
          <div style={actionsRowStyle}>
            <button className="btn-secondary" onClick={() => setPhase('choice')} disabled={isProcessing}>← Voltar</button>
            <button className="btn-primary" onClick={submitPartial} disabled={isProcessing || !inputText.trim()}>Actualizar Leitura</button>
          </div>
        </div>
      </div>
    );
  }

  // FASE INICIAL: CHOICE
  return (
    <div style={containerStyle}>
      <div className="splash" style={splashStyle}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>Isto bate certo com a realidade real?</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, width: '100%' }}>
          <button className="btn-primary" onClick={handleSim} disabled={isProcessing}>
            {isProcessing ? 'A pensar...' : 'Sim, faz sentido (Avançar)'}
          </button>
          <button className="btn-secondary" style={wideBtnStyle} onClick={handleParcialmente} disabled={isProcessing}>
            Parcialmente (Preciso adicionar um detalhe)
          </button>
          <button className="btn-secondary" style={wideBtnStyle} onClick={handleNaoEBemIsto} disabled={isProcessing}>
            {isProcessing ? 'A rever...' : 'Não é bem isto (Leram mal a situação)'}
          </button>
          <button style={abandonBtnStyle} onClick={handleNaoPercebi} disabled={isProcessing}>
            {isProcessing ? 'A reformular...' : 'Não percebi o que disseram'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Estilos ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  minHeight: '100vh', 
  background: 'var(--bg-color)', 
  position: 'relative',
  padding: '0 2rem'
};

const splashStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  paddingTop: '15vh'
};

const cardStyle: React.CSSProperties = {
  textAlign: 'left', 
  background: 'var(--bg-card)', 
  border: '1px solid var(--border-color)', 
  borderRadius: 12, 
  padding: 24, 
  fontSize: '0.95rem', 
  lineHeight: 1.7, 
  color: 'var(--text-main)'
};

const wideBtnStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'center',
  padding: '16px'
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  justifyContent: 'space-between'
};

const abandonBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  textDecoration: 'underline',
  cursor: 'pointer',
  padding: 8
};
