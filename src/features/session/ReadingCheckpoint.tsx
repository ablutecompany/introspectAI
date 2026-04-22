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
import { buildClarification } from '../../engine/clarification/clarificationEngine';

import { assimilateInputSemantic } from '../../engine/semantic/semanticAssimilationEngine';

interface Props {
  onProceed: () => void;
}

type CheckpointPhase = 'choice' | 'partial_input' | 'correction_choice' | 'clarification';

export const ReadingCheckpoint: React.FC<Props> = ({ onProceed }) => {
  const [phase, setPhase] = useState<CheckpointPhase>('choice');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { caseMemory, updateCaseMemory, setSessionStage, updateState, updateClarificationState, startFreshCase } = useSessionStore();

  const handleSim = () => {
    onProceed(); // O App tratará de chamar o continuationEngine e avançar para CONTINUATION_ACTIVE
  };

  const handleParcialmente = () => {
    setPhase('partial_input');
  };

  const handleNaoEBemIsto = () => {
    setPhase('correction_choice');
  };

  const handleNaoPercebi = () => {
    setPhase('clarification');
    // Registar imediatamente para evitar loops
    updateClarificationState('emergent_reading_check');
  };

  // ─── Phase: Partial Imput ──────────────────────────────────────────────────

  const submitPartial = () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);

    // Sprint 9: Assimilar a correção e decidir estrago feito
    const stateSnapshot = useSessionStore.getState();
    const semantic = assimilateInputSemantic(inputText, 'free', stateSnapshot);

    const isHardCorrection = semantic.category === 'correction' || semantic.category === 'disagreement';
    
    // Adicionamos a clarificação aos truth signals e registamos notas
    updateCaseMemory({
      progressSignals: [...(caseMemory.progressSignals ?? []), `Correção Parcial: ${inputText.trim()}`],
      // Se for hard correction, apagamos a provisória
      ...(isHardCorrection ? { provisionalHypothesis: null, confidenceState: 'insufficient' as const } : {})
    });

    // Avançamos para o continuation engine
    setTimeout(() => {
      onProceed();
    }, 400);
  };

  // ─── Phase: Correction Choice ──────────────────────────────────────────────

  const handleCorrectionFocoCertoExplicacaoNao = () => {
    // 1 - Manter a área e currentFocus, mas largar a hipótese e reduzir a confiança
    updateCaseMemory({
      provisionalHypothesis: null,
      confidenceState: 'insufficient'
    });
    // Voltar o session stage para trás para permitir nova discriminação no App
    onProceed();
  };

  const handleCorrectionNemFocoCerto = () => {
    // 2 - A leitura não bate mesmo. Limpa currentFocus e hipótese.
    updateCaseMemory({
      currentFocus: null,
      provisionalHypothesis: null,
      confidenceState: 'insufficient'
    });
    // O sistema fará triage no motor de continuação ou pedirá free text.
    onProceed();
  };

  const handleCorrectionNaoSei = () => {
    // 3 - Encerrar a sessão de forma honesta sem fingir maturidade.
    updateState({ 
        phase: 'CLOSE_NOW', 
        sessionStage: 'CLOSE_NOW'
    });
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

  if (phase === 'correction_choice') {
    return (
      <div style={containerStyle}>
        <div className="splash" style={splashStyle}>
          <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>O que falhou na leitura?</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24, width: '100%' }}>
            <button className="btn-secondary" style={wideBtnStyle} onClick={handleCorrectionFocoCertoExplicacaoNao}>
              A zona da dor está certa — mas a explicação está errada
            </button>
            <button className="btn-secondary" style={wideBtnStyle} onClick={handleCorrectionNemFocoCerto}>
              Nem os alicerces batem certo
            </button>
            <button className="btn-secondary" style={wideBtnStyle} onClick={handleCorrectionNaoSei}>
              Não sei, mas não mexeu comigo
            </button>
            <button style={{ ...abandonBtnStyle, marginTop: 12 }} onClick={() => setPhase('choice')}>← Voltar</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'clarification') {
    const currentState = useSessionStore.getState();
    const clarification = buildClarification('emergent_reading_check', currentState);

    if (!clarification.canClarifyAgain) {
       return (
        <div style={containerStyle}>
          <div className="splash" style={splashStyle}>
            <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>Pista Abandonada</h1>
            <p style={{ marginBottom: 24, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
              {clarification.exitLine}
            </p>
            <button className="btn-primary" onClick={handleCorrectionNaoSei}>
              Encerrar esta exploração
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={containerStyle}>
        <div className="splash" style={splashStyle}>
          <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>Resumindo...</h1>
          <div style={cardStyle}>
            {clarification.reformulatedQuestion}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
             <button className="btn-primary" onClick={handleSim}>Agora percebi (Faz sentido)</button>
             <button className="btn-secondary" onClick={() => setPhase('correction_choice')}>Não faz sentido na mesma</button>
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
          <button className="btn-primary" onClick={handleSim}>Sim, faz sentido (Avançar)</button>
          <button className="btn-secondary" style={wideBtnStyle} onClick={handleParcialmente}>Parcialmente (Preciso adicionar um detalhe)</button>
          <button className="btn-secondary" style={wideBtnStyle} onClick={handleNaoEBemIsto}>Não é bem isto (Leram mal a situação)</button>
          <button style={abandonBtnStyle} onClick={handleNaoPercebi}>Não percebi o que disseram</button>
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
