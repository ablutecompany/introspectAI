import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { useVoiceController } from '../features/voice/useVoiceController';
import { TriageFlow } from '../features/triage/TriageFlow';
import { ReentryGate } from '../features/session/ReentryGate';
import { FollowUpFlow } from '../features/session/FollowUpFlow';
import type { TriageState } from '../types/internalState';
import type { ConversationTurnOutput, ConversationTurnRequest } from '../shared/contracts/conversationTurnContract';
import './index.css';

export default function App() {
  const { phase, sessionStage, triageState, continuationState, updateState, setTriageState, lastTurnSnapshot } = useSessionStore();
  const updateCaseMemory = useSessionStore((s) => s.updateCaseMemory);
  const setSessionStage = useSessionStore((s) => s.setSessionStage);
  const continueExistingCase = useSessionStore((s) => s.continueExistingCase);
  const resumeAvailable = useSessionStore((s) => s.sessionMeta.resumeAvailable);
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
    const [llmStatus, setLlmStatus] = useState<'IDLE' | 'READY' | 'ERROR' | 'FALLBACK' | 'ENV_MISSING' | 'API_ERROR'>('IDLE');
  const [showTranscriptInput, setShowTranscriptInput] = useState(false);

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

  if (sessionStage === 'FOLLOW_UP_REENTRY') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        <FollowUpFlow />
      </div>
    );
  }

  if (phase === 'TRIAGE') {
    const handleTriageComplete = (triage: TriageState) => {
      setTriageState(triage);
             const openingPrompts = [
                 "Se tivesses de pegar numa ponta disto, qual seria?",
                 "O que é que está mais vivo em ti agora?",
                 "Por onde queres começar?",
                 "Se começarmos pelo mais próximo, qual é?"
             ];
             const selectedPrompt = openingPrompts[Math.floor(Math.random() * openingPrompts.length)];
             
             updateState({
                 phase: 'CONTINUATION_ACTIVE',
                 sessionStage: 'PROVISIONAL_FOCUS',
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
                        mainText: `Recebi as tuas notas. ${selectedPrompt}`
                    }
                 }
             });
    };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', position: 'relative' }}>
        {renderVoiceToggle()}
        {renderDebugShortcut()}
        <TriageFlow onComplete={handleTriageComplete} />
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

    const isClosing = phase === 'CLOSE_NOW' || continuationState.shouldCloseAfterThisTurn;
    const requiresInteraction = !isClosing;

    const submitResponse = async (shortcutMode?: 'close' | 'refute') => {
       let userText = inputText.trim() || transcript.trim();
       let actionType: ConversationTurnRequest['user_action_type'] = 'normal_text_input';
       
       if (shortcutMode === 'close') {
           userText = "";
           actionType = 'shortcut_refusal';
       } else if (shortcutMode === 'refute') {
           userText = "";
           actionType = 'shortcut_disagreement';
       }

       if (!userText && !shortcutMode) return;
       
       if (actionType === 'normal_text_input') {
           useSessionStore.getState().saveSnapshot(userText);
       }

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
               salientTerms: currentState.caseMemory.salientTerms || [],
               user_action_type: actionType,
               user_action_payload: shortcutMode === 'close' ? 'redirect_or_close' : undefined
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
           
           if (turnResult.assistant_text.includes("[FALLBACK ENGINE]")) {
               if (turnResult.assistant_text.includes("OPENAI_API_KEY")) {
                   setLlmStatus('ENV_MISSING');
               } else if (turnResult.assistant_text.includes("completions") || turnResult.assistant_text.includes("parse")) {
                   setLlmStatus('API_ERROR');
               } else {
                   setLlmStatus('FALLBACK');
               }
           } else {
               setLlmStatus('READY');
           }

           const memoryUpdate: Partial<typeof currentState.caseMemory> = {};
           if (turnResult.updated_focus) memoryUpdate.currentFocus = turnResult.updated_focus;
           if (turnResult.updated_hypothesis) memoryUpdate.provisionalHypothesis = turnResult.updated_hypothesis;
           
           if (turnResult.understanding_status === 'disagreement' || turnResult.user_input_interpretation.includes('correction')) {
               memoryUpdate.lastCorrectionSignal = userText;
               memoryUpdate.correctionNote = 'Correção via LLM';
               memoryUpdate.confidenceState = 'insufficient';
           }

           if (turnResult.focus_probabilities) {
               const probs = turnResult.focus_probabilities;
               const sortedFoci = Object.entries(probs).sort((a, b) => b[1] - a[1]);
               const primary = sortedFoci[0];
               if (primary && primary[1] > 0.3) {
                   memoryUpdate.primaryFocusProb = primary[1];
                   if (!memoryUpdate.currentFocus) {
                       memoryUpdate.currentFocus = primary[0];
                   }
                   
                   memoryUpdate.rivalFoci = sortedFoci
                       .slice(1)
                       .filter(f => f[1] > 0.3 && (primary[1] - f[1]) < 0.25)
                       .map(f => f[0]);
               }
           }

           if (Object.keys(memoryUpdate).length > 0) {
               useSessionStore.getState().updateCaseMemory(memoryUpdate);
           }

           markMeaningfulInteraction();

           if (turnResult.next_action === 'assign_work' || turnResult.close_session) {
               updateState({
                   phase: 'CLOSE_NOW',
                   sessionStage: 'WORK_ASSIGNMENT',
               });
               
               if (turnResult.concrete_task) {
                   const memoryUpdate: Partial<typeof currentState.caseMemory> = {
                       assignedWork: `AÇÃO: ${turnResult.concrete_task.action}\nDURAÇÃO: ${turnResult.concrete_task.duration}\nGATILHO: ${turnResult.concrete_task.trigger}\nOBSERVAR: ${turnResult.concrete_task.observable}`
                   };
                   useSessionStore.getState().updateCaseMemory(memoryUpdate);
               }
               
               setInputText('');
               setIsProcessing(false);
               return;
           }

           updateState({
              continuationState: {
                  ...continuationState!,
                  outputPayload: {
                      ...continuationState!.outputPayload!,
                      title: 'Explorar',
                      mainText: turnResult.needs_clarification ? (turnResult.clarification_text || turnResult.assistant_text) : turnResult.assistant_text,
                      optionalPrompt: undefined,
                      closingText: undefined
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
                    background: llmStatus === 'READY' ? '#22c55e' : (llmStatus === 'ERROR' || llmStatus === 'API_ERROR' || llmStatus === 'ENV_MISSING') ? '#ef4444' : llmStatus === 'FALLBACK' ? '#f59e0b' : '#64748b',
                    color: '#fff'
                  }}>
                    MOTOR: {llmStatus}
                  </div>
                )}
              </div>
            
            <div style={{ textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-main)', marginBottom: 24 }}>
              <p style={{ margin: 0 }}>{p.mainText}</p>
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
                       Responder
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
            
            {/* Fim Absoluto da Sessão - Fecho Dinâmico */}
            {!requiresInteraction && (
               <div style={{ marginTop: 24, padding: 24, background: 'var(--bg-card)', border: '1px solid var(--accent-base)', borderRadius: 12, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                 {useSessionStore.getState().caseMemory.assignedWork ? (
                   <>
                     <h2 style={{ fontSize: '1.1rem', marginBottom: 16, color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                       <span>🎯</span> O Teu Ponto de Trabalho
                     </h2>
                     <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6 }}>
                       {useSessionStore.getState().caseMemory.assignedWork}
                     </div>
                   </>
                 ) : (
                   <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 16 }}>
                     A sessão foi encerrada sem tarefa atribuída.
                   </div>
                 )}
                 <div style={{ marginTop: 20, textAlign: 'center' }}>
                   <button onClick={() => {
                     useSessionStore.getState().startFreshCase();
                   }} className="btn-primary" style={{ background: 'var(--border-color)', color: 'white' }}>
                     Fechar e Iniciar Nova Exploração
                   </button>
                 </div>
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
