import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { useVoiceController } from '../features/voice/useVoiceController';
import { TriageFlow } from '../features/triage/TriageFlow';
import { buildLatentAndGuidanceDeterministic } from '../engine/latentGuidanceEngine';
import { decideContinuationMode } from '../engine/continuation/continuationEngine';
import type { TriageState } from '../types/internalState';
import './index.css';

export default function App() {
  const { phase, triageState, continuationState, updateState, setTriageState } = useSessionStore();
  const { 
    voiceState, 
    speakLine, 
    startListening, 
    stopListening, 
    stopSpeaking, 
    toggleAudioMode 
  } = useVoiceController();

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTranscriptInput, setShowTranscriptInput] = useState(false);

  // Derivados simples de UI de Voz
  const isListening = voiceState.status === 'listening';
  const isSpeaking = voiceState.status === 'speaking';
  const isSupported = voiceState.isSupportedSTT;
  const transcript = voiceState.transcriptDraft;
  const sttError = voiceState.lastError;

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening((f) => setInputText(f), (i) => setInputText(i));
  };
  
  const manualSetTranscript = (t: string) => {
    useSessionStore.setState(s => ({ ...s, voiceState: { ...s.voiceState, transcriptDraft: t } }));
  };

  const renderVoiceToggle = () => (
    voiceState.isSupportedTTS && (
      <button 
        onClick={() => toggleAudioMode()}
        style={{
          position: 'absolute', top: 16, right: 16, padding: '8px 16px', borderRadius: 20,
          background: voiceState.audioModeEnabled ? 'var(--accent-base)' : 'transparent',
          border: `1px solid ${voiceState.audioModeEnabled ? 'var(--accent-text)' : 'var(--border-color)'}`,
          color: voiceState.audioModeEnabled ? 'var(--text-main)' : 'var(--text-muted)',
          cursor: 'pointer', zIndex: 100, fontSize: '0.85rem'
        }}
      >
        {voiceState.audioModeEnabled ? '🔊 Som Ativo' : '🔈 Som Mudo'}
      </button>
    )
  );

  // ─── Render: TRIAGE ──────────────────────────────────────────────────────────
  if (phase === 'TRIAGE') {
    const handleTriageComplete = (triage: TriageState) => {
      setTriageState(triage);
      // O componente transita agora atomicamente para LATENT_READING_DISPLAY no Store
    };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        <TriageFlow onComplete={handleTriageComplete} />
      </div>
    );
  }

  // ─── Render: LATENT READING DISPLAY ──────────────────────────────────────────
  if (phase === 'LATENT_READING_DISPLAY') {
    if (!triageState) return null;
    const motorOutput = buildLatentAndGuidanceDeterministic(useSessionStore.getState());
    
    const handleProceed = () => {
      stopSpeaking();
      const state = useSessionStore.getState();
      const contState = decideContinuationMode(state);
      updateState({ phase: 'CONTINUATION_ACTIVE', continuationState: contState });
    };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        <div className="container" style={{ padding: '0 2rem' }}>
          <div className="splash" style={{ maxWidth: 640 }}>
            <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>Leitura Latente</h1>
            
            <div style={{ textAlign: 'left', background: 'var(--accent-base)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-main)', marginBottom: 24 }}>
              <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)' }}>
                {motorOutput.latentParagraph}
              </p>
            </div>

            <button className="btn-primary" style={{ marginTop: 20 }} onClick={handleProceed}>
              Descobrir Padrão de Fricção
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: CONTINUATION & CLOSE ───────────────────────────────────────────
  if (phase === 'CONTINUATION_ACTIVE' || phase === 'CLOSE_NOW') {
    const p = continuationState?.outputPayload;
    if (!p) return null;

    const requiresInteraction = p.optionalPrompt && !continuationState.shouldCloseAfterThisTurn;

    // A resposta encerra a aplicação liminarmente (Bypass de Loops Infinitos LLM)
    const submitResponse = (shortcutMode?: 'close' | 'refute') => {
       setIsProcessing(true);
       stopListening();
       stopSpeaking();
       
       setTimeout(() => {
          // Marcar o uso como 1 turno máximo
          let reasonText = 'Sessão concluída após input.';
          if (shortcutMode === 'refute') reasonText = 'Sessão encerrada (hipótese descartada pelo utilizador).';

          const forceCloseState = decideContinuationMode({
             ...useSessionStore.getState(),
             governance: { ...useSessionStore.getState().governance, shouldCloseNow: true, lastGovernanceReason: reasonText },
             continuationState: {
                ...useSessionStore.getState().continuationState,
                continuationResolved: true,
                turnsUsedInMode: 1
             }
          });
          
          updateState({ phase: 'CLOSE_NOW', continuationState: forceCloseState });
          setInputText('');
          setIsProcessing(false);
       }, 500);
    };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        
        <div className="container" style={{ padding: '0 2rem' }}>
          <div className="splash" style={{ maxWidth: 640 }}>
            <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>{p.title}</h1>
            
            <div style={{ textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-main)', marginBottom: 24 }}>
              <p style={{ margin: '0 0 16px 0' }}>{p.mainText}</p>
              
              {p.optionalPrompt && (
                <p style={{ margin: '16px 0 0 0', fontWeight: 500, color: 'var(--accent-text)' }}>{p.optionalPrompt}</p>
              )}

              {p.closingText && (
                <p style={{ margin: '16px 0 0 0', fontWeight: 500, color: 'var(--text-muted)' }}>{p.closingText}</p>
              )}
            </div>

            {requiresInteraction && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}>
                <div style={{ width: '100%' }}>
                   <textarea
                     value={inputText}
                     onChange={e => setInputText(e.target.value)}
                     placeholder="A tua resposta (opcional)..."
                     disabled={isProcessing}
                     style={{ fontSize: '0.95rem', minHeight: 80, width: '100%' }}
                   />
                </div>

                <div className="audio-live-container" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      onClick={toggleListening}
                      disabled={!isSupported || isProcessing || isSpeaking}
                      style={{
                        width: 64, height: 64, borderRadius: '50%',
                        border: isListening ? '4px solid #fecaca' : 'none',
                        background: isProcessing ? '#fbbf24' : isListening ? '#ef4444' : isSpeaking ? '#3b82f6' : '#1e293b',
                        color: '#fff', cursor: (!isSupported || isSpeaking || isProcessing) ? 'not-allowed' : 'pointer',
                        boxShadow: isListening ? '0 0 16px rgba(239,68,68,0.4)' : 'none',
                        transition: '0.2s all'
                      }}
                    >
                      <span style={{ fontSize: '1.4rem' }}>{isProcessing ? '⏳' : isSpeaking ? '🔊' : '🎙️'}</span>
                    </button>

                    <button className="btn-primary" onClick={() => submitResponse()} disabled={isProcessing || (!inputText.trim() && !transcript.trim())}>
                       Responder & Fechar
                    </button>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: 12 }}>
                        <button className="btn-secondary" onClick={() => submitResponse('refute')} disabled={isProcessing} style={{ fontSize: '0.8.5rem', background: '#ffe4e6', color: '#be123c', border: 'none' }}>
                           Não é bem isso
                        </button>
                        <button className="btn-secondary" onClick={() => submitResponse('close')} disabled={isProcessing} style={{ fontSize: '0.8.5rem', background: '#f1f5f9', color: '#475569', border: 'none' }}>
                           Não pretendo responder
                        </button>
                    </div>
                </div>

                {transcript && (
                  <div style={{ width: '100%', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                    <p style={{ margin: 0, color: '#334155', fontStyle: 'italic' }}>"{transcript}"</p>
                    {!showTranscriptInput && (
                      <div style={{ textAlign: 'right', marginTop: 8 }}>
                          <button onClick={() => setShowTranscriptInput(true)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}>Corrigir Transcrição</button>
                      </div>
                    )}
                    {showTranscriptInput && (
                      <textarea value={transcript} onChange={e => manualSetTranscript(e.target.value)} disabled={isProcessing || isListening} style={{ minHeight: 60, marginTop: 12 }} />
                    )}
                  </div>
                )}
                {sttError && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>Erro microfone: {sttError}</div>}
              </div>
            )}
            
            {/* Fim Absoluto da Sessão */}
            {!requiresInteraction && (
               <div style={{ marginTop: 24, padding: 16, borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                 A sessão está fechada. Leva a leitura e aplica o exercício offline.<br/><br/>
                 <button onClick={() => {
                   useSessionStore.getState().resetSession();
                 }} className="btn-primary" style={{ marginTop: 12, background: 'var(--border-color)', color: 'white' }}>
                   Nova Triagem Livre
                 </button>
               </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#fff' }}>
        Fase desconhecida na Máquina de Estados.
     </div>
  );
}
