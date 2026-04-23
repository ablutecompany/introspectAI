import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { useVoiceController } from '../features/voice/useVoiceController';
import { TriageFlow } from '../features/triage/TriageFlow';
import { ReentryGate } from '../features/session/ReentryGate';
import { FollowUpFlow } from '../features/session/FollowUpFlow';
import { ReadingCheckpoint } from '../features/session/ReadingCheckpoint';
import { buildLatentAndGuidanceDeterministic } from '../engine/latentGuidanceEngine';
import { decideContinuationMode } from '../engine/continuation/continuationEngine';
import { inferSessionStageFromLegacyPhase } from '../engine/session/phaseCompatibility';
import { buildDiscriminationQuestion, interpretDiscriminationAnswer } from '../engine/session/discriminationEngine';
import { buildEmergentReading, inferReadingStageFromMemory } from '../engine/emergentReadingEngine';
import type { TriageState } from '../types/internalState';
import type { ConversationTurnOutput, ConversationTurnRequest } from '../shared/contracts/conversationTurnContract';
import './index.css';

export default function App() {
  const { phase, sessionStage, triageState, continuationState, updateState, setTriageState, lastTurnSnapshot } = useSessionStore();
  const updateCaseMemory = useSessionStore((s) => s.updateCaseMemory);
  const setSessionStage = useSessionStore((s) => s.setSessionStage);
  const continueExistingCase = useSessionStore((s) => s.continueExistingCase);
  const resumeAvailable = useSessionStore((s) => s.sessionMeta.resumeAvailable);
  // Sprint 6: ligar markMeaningfulInteraction nos inputs reais de CONTINUATION_ACTIVE
  const markMeaningfulInteraction = useSessionStore((s) => s.markMeaningfulInteraction);
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
    const [llmStatus, setLlmStatus] = useState<'IDLE' | 'READY' | 'ERROR' | 'FALLBACK'>('IDLE');
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

  const renderDebugShortcut = () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isVercelPreview = window.location.hostname.includes('vercel.app') && !window.location.hostname.startsWith('introspect.ai');
    
    if (!isLocalhost && !isVercelPreview) return null;

    return (
      <button 
        onClick={() => {
           const state = useSessionStore.getState();
           state.startFreshCase();
           state.updateCaseMemory({
               currentFocus: 'Ansiedade com prazos de entrega no trabalho',
               provisionalHypothesis: 'Perfeccionismo a bloquear a execução e a gerar paralisia',
               lastExtractedMeaning: 'O utilizador sente um peso enorme quando se aproximam deadlines, acabando por não fazer nada por medo de falhar.',
               salientTerms: ['paralisia', 'prazo', 'medo', 'bloqueio']
           });
           state.updateState({
               phase: 'CONTINUATION_ACTIVE',
               sessionStage: 'EXPLORATION',
               continuationState: {
                   outputPayload: {
                       title: '[DEBUG] Atalho de Exploração',
                       mainText: 'O motor foi inicializado com o contexto de ansiedade e prazos de entrega.',
                       optionalPrompt: 'O que te parece a hipótese do perfeccionismo estar a gerar paralisia perante o deadline?'
                   },
                   continuationResolved: false,
                   turnsUsedInMode: 0
               }
           });
        }}
        style={{
          position: 'absolute', bottom: 16, right: 16, padding: '8px 16px', borderRadius: 8,
          background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontSize: '0.8rem', border: '1px solid rgba(59, 130, 246, 0.3)', cursor: 'pointer',
          zIndex: 9999
        }}
      >
        [Dev] Fast-Forward para EXPLORATION
      </button>
    );
  };

  // ─── Render: REENTRADA (caso retomável no mesmo browser) ────────────────────
  // Mostrado antes da triagem, se existir caso válido persistido.
  if (phase === 'TRIAGE' && resumeAvailable) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        {renderDebugShortcut()}
        <ReentryGate
          onContinue={() => {
            continueExistingCase();
          }}
          onStartFresh={() => {
            useSessionStore.getState().startFreshCase();
          }}
        />
      </div>
    );
  }

  // ─── Render: FOLLOW_UP_REENTRY (reentrada real — não volta à triagem) ────────
  if (sessionStage === 'FOLLOW_UP_REENTRY') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        <FollowUpFlow />
      </div>
    );
  }

  // ─── Render: TRIAGE (nova exploração) ────────────────────────────────────────
  if (phase === 'TRIAGE') {
    const handleTriageComplete = (triage: TriageState) => {
      setTriageState(triage);
      // O componente transita agora atomicamente para LATENT_READING_DISPLAY no Store
    };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        {renderDebugShortcut()}
        <TriageFlow onComplete={handleTriageComplete} />
      </div>
    );
  }

  // ─── Render: READING (Provisória ou Emergente) ──────────────────────────────
  if (phase === 'LATENT_READING_DISPLAY') {
    const currentState = useSessionStore.getState();

    // Sprint 4: Tentar gerar leitura emergente se o caso tiver maturidade
    const emergentOutput = buildEmergentReading(currentState);
    const motorOutput = emergentOutput ? null : buildLatentAndGuidanceDeterministic(currentState);
    
    const handleProceed = () => {
      stopSpeaking();
      const state = useSessionStore.getState();
      
      // Sprint 8: Em Leitura Emergente, não vamos logo para a orientação de trabalho.
      // Paramos no ReadingCheckpoint para confirmar se a leitura bate certo.
      if (emergentOutput) {
        setSessionStage('READING_CHECKPOINT');
        return;
      }

      // Sprint 4: Se for hipótese provisória, avança normalmente.
      const correctStage = inferReadingStageFromMemory(state.caseMemory);
      const contState = decideContinuationMode(state);
      
      updateState({ 
         phase: 'CONTINUATION_ACTIVE', 
         sessionStage: correctStage,
         continuationState: contState 
      });
    };

    // ─── Render: READING CHECKPOINT (Sprint 8) ────────────────────────────────
    if (emergentOutput && sessionStage === 'READING_CHECKPOINT') {
      const handleCheckpointProceed = () => {
         const state = useSessionStore.getState();
         const correctStage = inferReadingStageFromMemory(state.caseMemory);
         const contState = decideContinuationMode(state);
         
         updateState({ 
            phase: 'CONTINUATION_ACTIVE', 
            sessionStage: correctStage,
            continuationState: contState 
         });
      };

      return (
        <ReadingCheckpoint onProceed={handleCheckpointProceed} />
      );
    }

    // ─── Render: LEITURA EMERGENTE (com maturidade) ──────────────────────────
    if (emergentOutput) {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
          {renderVoiceToggle()}
          <div className="container" style={{ padding: '0 2rem' }}>
            <div className="splash" style={{ maxWidth: 640 }}>
              <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>{emergentOutput.title}</h1>
              
              <div style={{ textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-main)', marginBottom: 24 }}>
                <p style={{ margin: '0 0 20px 0' }}>
                  {emergentOutput.readingParagraph}
                </p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                  {emergentOutput.lightGuidance}
                </p>
              </div>

              <button className="btn-primary" style={{ marginTop: 20 }} onClick={handleProceed}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ─── Render: HIPÓTESE PROVISÓRIA (sem maturidade suficiente ainda) ────────
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        <div className="container" style={{ padding: '0 2rem' }}>
          <div className="splash" style={{ maxWidth: 640 }}>
            <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>Hipótese Provisória</h1>
            
            <div style={{ textAlign: 'left', background: 'var(--accent-base)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-main)', marginBottom: 24 }}>
              <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)' }}>
                {motorOutput?.provisionalHypothesisParagraph}
              </p>
              {motorOutput?.needsDiscrimination && (
                 <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed rgba(255,255,255,0.2)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <em>Nota: Foco partilhado ou difuso. Será útil discriminar a causa raiz de seguida.</em>
                 </div>
              )}
            </div>

            <button className="btn-primary" style={{ marginTop: 20 }} onClick={handleProceed}>
              Explorar Padrão de Fricção
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: CONTINUATION & CLOSE ───────────────────────────────────────────
  if (phase === 'CONTINUATION_ACTIVE' || phase === 'CLOSE_NOW') {
    const p = continuationState?.outputPayload;
    if (!p) {
       return (
         <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div style={{ textAlign: 'center', padding: '2rem' }}>
             <p style={{ color: 'var(--text-muted)' }}>Ocorreu um erro no carregamento da fase seguinte.</p>
             <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => useSessionStore.getState().startFreshCase()}>
               Recomeçar
             </button>
           </div>
         </div>
       );
    }

    const requiresInteraction = p.optionalPrompt && !continuationState.shouldCloseAfterThisTurn;

    // A resposta encerra a aplicação liminarmente (Bypass de Loops Infinitos LLM)
    const submitResponse = async (shortcutMode?: 'close' | 'refute') => {
       const userText = inputText.trim() || transcript.trim();
       useSessionStore.getState().saveSnapshot(userText);

       const forceCloseSession = (reasonText: string) => {
          setTimeout(() => {
            const forceCloseState = decideContinuationMode({
               ...useSessionStore.getState(),
               governance: { ...useSessionStore.getState().governance, shouldCloseNow: true, lastGovernanceReason: reasonText },
               continuationState: {
                  ...useSessionStore.getState().continuationState,
                  continuationResolved: true,
                  turnsUsedInMode: 1
               }
            });
            
            updateState({ 
               phase: 'CLOSE_NOW', 
               sessionStage: inferSessionStageFromLegacyPhase('CLOSE_NOW'),
               continuationState: forceCloseState 
            });
            
            setInputText('');
            setIsProcessing(false);
          }, 300);
       };

       if (shortcutMode === 'close' || shortcutMode === 'refute') {
          forceCloseSession('Sessão encerrada pelo utilizador (' + shortcutMode + ').');
          return;
       }

       if (!userText) return;

       setIsProcessing(true);
       stopListening();
       stopSpeaking();

       const currentState = useSessionStore.getState();

       try {
           const reqPayload: ConversationTurnRequest = {
               sessionStage: 'EXPLORATION',
               caseSummary: currentState.caseMemory.lastExtractedMeaning || 'Resumo indisponível.',
               currentFocus: currentState.caseMemory.currentFocus || null,
               currentHypothesis: currentState.caseMemory.provisionalHypothesis || null,
               lastUserInput: userText,
               lastAssistantTurn: p.optionalPrompt || p.mainText,
               checkpointState: null,
               conversationDepth: currentState.sessionMeta.turnCount,
               previousCorrections: [],
               salientTerms: currentState.caseMemory.salientTerms || []
           };

           const res = await fetch('/api/conversationTurn', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(reqPayload)
           });

           if (!res.ok) { 
                const errData = await res.json().catch(() => ({ error: 'No JSON body' }));
                console.error('[Frontend DEBUG] API Failure:', res.status, errData); 
                throw new Error('API Error ' + res.status + ': ' + (errData.error || 'Unknown')); 
            }
           const turnResult: ConversationTurnOutput = await res.json();
            setLlmStatus('READY');

           const memoryUpdate: Partial<typeof currentState.caseMemory> = {};
           if (turnResult.updated_focus) memoryUpdate.currentFocus = turnResult.updated_focus;
           if (turnResult.updated_hypothesis) memoryUpdate.provisionalHypothesis = turnResult.updated_hypothesis;
           
           if (turnResult.understanding_status === 'disagreement' || turnResult.user_input_interpretation.includes('correction')) {
               memoryUpdate.lastCorrectionSignal = userText;
               memoryUpdate.correctionNote = 'Correção via LLM';
               memoryUpdate.confidenceState = 'insufficient';
           }

           if (Object.keys(memoryUpdate).length > 0) {
               useSessionStore.getState().updateCaseMemory(memoryUpdate);
           }

           markMeaningfulInteraction();

           if (turnResult.close_session) {
               forceCloseSession('Sessão fechada após análise LLM.');
               return;
           }

           if (turnResult.next_action === 'proceed' || turnResult.checkpoint_signal || turnResult.target_stage === 'READING_CHECKPOINT') {
               updateState({ 
                   phase: 'LATENT_READING_DISPLAY', 
                   sessionStage: 'READING_CHECKPOINT'
               });
               setInputText('');
               setIsProcessing(false);
               return;
           }

           updateState({
              continuationState: {
                  ...continuationState!,
                  outputPayload: {
                      ...continuationState!.outputPayload!,
                      optionalPrompt: (turnResult.assistant_text.includes("[FALLBACK") || turnResult.assistant_text.includes("[DEBUG]")) ? turnResult.assistant_text : (turnResult.needs_clarification ? (turnResult.clarification_text || turnResult.assistant_text) : turnResult.assistant_text)
                  }
              }
           });
           
           setInputText('');
           setIsProcessing(false);

       } catch (err: any) { 
            console.error("[Frontend DEBUG] Falha na API:", err);
            setLlmStatus(err.message.includes('API Error') ? 'ERROR' : 'FALLBACK');
            const isDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('vercel.app');
           updateState({
              continuationState: {
                  ...continuationState!,
                  outputPayload: {
                      ...continuationState!.outputPayload!,
                      optionalPrompt: isDev ? `[DEBUG] Falha no Motor LLM: ${err.message}` : "Tive uma falha de rede temporária. Podes tentar repetir a tua última resposta?"
                  }
              }
           });
           setInputText('');
           setIsProcessing(false);
       }
    };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        
        <div className="container" style={{ padding: '0 2rem' }}>
          <div className="splash" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', width: '100%' }}>
                <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{p.title}</h1>
                {(window.location.hostname.includes('localhost') || window.location.hostname.includes('vercel.app')) && (
                  <div style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 700, 
                    padding: '4px 8px', 
                    borderRadius: 4, 
                    background: llmStatus === 'READY' ? '#22c55e' : llmStatus === 'ERROR' ? '#ef4444' : llmStatus === 'FALLBACK' ? '#f59e0b' : '#64748b',
                    color: '#fff'
                  }}>
                    MOTOR: {llmStatus}
                  </div>
                )}
              </div>
            
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

                {lastTurnSnapshot && (
                  <div style={{ width: '100%', textAlign: 'center', marginTop: 12 }}>
                    <button 
                      className="btn-secondary" 
                      disabled={isProcessing}
                      onClick={() => {
                        const text = useSessionStore.getState().restoreSnapshot();
                        if (text !== null) {
                          setInputText(text);
                        }
                      }}
                      style={{ fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', background: 'transparent' }}
                    >
                      ↩ Voltar e corrigir a resposta anterior
                    </button>
                  </div>
                )}

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
                   useSessionStore.getState().startFreshCase();
                 }} className="btn-primary" style={{ marginTop: 12, background: 'var(--border-color)', color: 'white' }}>
                   Começar nova exploração
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
