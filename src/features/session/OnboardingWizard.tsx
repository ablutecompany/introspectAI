import { useState, useEffect } from 'react';
import { useTTS } from '../../hooks/useTTS';
import { useSpeechInput } from '../../hooks/useSpeechInput';

const ONBOARDING_STEPS = [
  {
    step: 1,
    question: "Antes de começarmos, ajuda-me a perceber onde está o peso maior neste momento.",
    chips: ["Cansaço / sem energia", "Ansiedade / constante", "Problemas com outras pessoas", "Sinto-me bloqueado", "Ando perdido", "Não sei bem explicar"],
    synonyms: [
       { match: ['cansado', 'energia', 'exausto', 'esgotado', 'fadiga'], emit: 'Cansaço / sem energia' },
       { match: ['ansiedade', 'ansioso', 'nervoso', 'cabeça', 'pensar', 'stress'], emit: 'Ansiedade / constante' },
       { match: ['pessoas', 'alguém', 'relação', 'conflito', 'namorado', 'namorada', 'chefe'], emit: 'Problemas com outras pessoas' },
       { match: ['bloqueado', 'preso', 'parado', 'estagnado'], emit: 'Sinto-me bloqueado' },
       { match: ['perdido', 'rumo', 'orientação', 'confuso'], emit: 'Ando perdido' },
       { match: ['não sei', 'explicar', 'difícil'], emit: 'Não sei bem explicar' }
    ]
  },
  {
    step: 2,
    question: "Isto tem-te pesado quanto?",
    chips: ["Muito", "Bastante", "Mais ou menos", "Vai e vem", "É difícil dizer"],
    synonyms: [
       { match: ['muito', 'imenso', 'fortemente', 'absurdo', 'péssimo', 'horrível', 'pesado'], emit: 'Muito' },
       { match: ['bastante', 'um bocado', 'algum', 'significativo'], emit: 'Bastante' },
       { match: ['meio', 'razoável', 'médio', 'pouco'], emit: 'Mais ou menos' },
       { match: ['às vezes', 'depende', 'oscila', 'fases'], emit: 'Vai e vem' },
       { match: ['não sei', 'difícil dizer', 'complica'], emit: 'É difícil dizer' }
    ]
  },
  {
    step: 3,
    question: "Notas isto mais em que altura?",
    chips: ["Ao acordar", "Durante o dia", "À noite", "Quase sempre", "Depende", "Não sei"],
    synonyms: [
       { match: ['acordar', 'manhã', 'levanto'], emit: 'Ao acordar' },
       { match: ['dia', 'trabalhar', 'tarde', 'cotidiano'], emit: 'Durante o dia' },
       { match: ['noite', 'deitar', 'dormir', 'fim do dia'], emit: 'À noite' },
       { match: ['sempre', 'constante', 'toda a hora', 'direto'], emit: 'Quase sempre' },
       { match: ['varia', 'variável'], emit: 'Depende' },
       { match: ['difícil dizer'], emit: 'Não sei' }
    ]
  },
  {
    step: 4,
    question: "Isto pesa-te mais como quê?",
    chips: ["Cansaço", "Medo", "Pressão", "Confusão", "Mistura de tudo", "Não sei explicar"],
    synonyms: [
       { match: ['corpo', 'fadiga', 'dormir'], emit: 'Cansaço' },
       { match: ['receio', 'assustado', 'pânico', 'fobia'], emit: 'Medo' },
       { match: ['peso', 'cobrança', 'responsabilidade', 'stress'], emit: 'Pressão' },
       { match: ['dúvida', 'vazio', 'pensamento'], emit: 'Confusão' },
       { match: ['mistura', 'tudo', 'vários', 'combo', 'tudo misturado'], emit: 'Mistura de tudo' },
       { match: ['não sei', 'difícil'], emit: 'Não sei explicar' }
    ]
  },
  {
    step: 5,
    question: "Se tivesses de me dar um exemplo simples, o que é que mais mostra isso no teu dia-a-dia?",
    chips: ["No trabalho", "Em casa", "Com pessoas", "Dentro da cabeça", "Não sei"],
    synonyms: [] // Passo 5 aceita voz 100% livre
  }
];

interface OnboardingWizardProps {
   onComplete: (stitchedTranscript: string) => void;
   mode: 'conversation' | 'writing';
   isProcessing: boolean;
}

export function OnboardingWizard({ onComplete, mode, isProcessing }: OnboardingWizardProps) {
   const [currentStepIndex, setCurrentStepIndex] = useState(0);
   const [buffer, setBuffer] = useState<string[]>([]);
   const { speak, stop: stopTTS, ttsError } = useTTS();
   const { isListening, startListening, stopListening, toggleListening, manualSetTranscript, transcript: voiceTranscript, isSupported } = useSpeechInput();
   
   // Strict UI State Machine
   const [uIState, setUIState] = useState<'booting' | 'needs_user_gesture' | 'tts_failed' | 'speaking' | 'listening' | 'processing_match' | 'match_success' | 'match_fail' | 'idle'>('booting');
   const [feedbackMsg, setFeedbackMsg] = useState("");
   const [matchedChip, setMatchedChip] = useState<string | null>(null);

   const currentStep = ONBOARDING_STEPS[currentStepIndex];

   // Normalizer for Layer A
   const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();

   const fireTTSLoop = () => {
       setUIState('booting');
       speak(
         currentStep.question, 
         () => setUIState('speaking'), // onStart
         () => {
            // onEnd: Switch to microphone
            if (mode === 'conversation' && isSupported) {
               setUIState('listening');
               startListening();
            } else {
               setUIState('idle');
            }
         },
         () => {
            // onError / Timeouts
            setUIState('tts_failed');
         }
       );
   };

   // Core Transition Engine
   useEffect(() => {
     if (mode === 'conversation' && currentStep.question) {
        // Assume first we need a gesture on mount if index is 0, since many browsers drop prior Splash context
        if (currentStepIndex === 0 && uIState === 'booting') {
           setUIState('needs_user_gesture');
        } else {
           fireTTSLoop();
        }
     }
     return () => stopTTS();
   }, [currentStepIndex, mode, stopTTS, isSupported, currentStep.question]);

   const commitOnboardingAnswer = (stepId: number, rawInput: string, finalChipValue: string) => {
      console.log(`[Onboarding Commit] Step: ${stepId} | Raw: "${rawInput}" | Option: "${finalChipValue}"`);
      
      stopListening();
      setUIState('match_success');
      setFeedbackMsg("Percebi.");
      setMatchedChip(finalChipValue);

      setTimeout(() => {
         const newBuffer = [...buffer, finalChipValue];
         setMatchedChip(null);
         setFeedbackMsg(""); 
         setUIState('idle');
         
         if (currentStepIndex === ONBOARDING_STEPS.length - 1) {
           const finalTranscript = `[User Context Buffer]: Peso principal: ${newBuffer[0]}. Intensidade: ${newBuffer[1]}. Momento: ${newBuffer[2]}. Tipo de peso: ${newBuffer[3]}. Exemplo dominante: ${newBuffer[4]}`;
           onComplete(finalTranscript);
         } else {
           setBuffer(newBuffer);
           setCurrentStepIndex(prev => prev + 1);
           manualSetTranscript("");
         }
      }, 700); 
   };

   // Handle Semantic Matching and Silence Trigger
   useEffect(() => {
      if (mode !== 'conversation' || !isListening || voiceTranscript.trim().length < 3 || uIState === 'processing_match') return;
      
      const rawSpeech = voiceTranscript;
      const normalizedSpeech = normalize(rawSpeech);

      if (currentStepIndex === 4) {
         // Open speech -> wait for silence only
      } else {
         // EAGER LAYER A / B EVALUATION - Real-time hotword trapping
         let directMatch = currentStep.chips.find(c => normalize(c) === normalizedSpeech);
         if (directMatch) {
             console.log(`[Realtime Pipeline] Layer A Instant Match: ${directMatch}`);
             commitOnboardingAnswer(currentStep.step, rawSpeech, directMatch);
             return;
         }

         let synMatch = currentStep.synonyms.find(syn => syn.match.some(m => normalizedSpeech.includes(normalize(m))));
         if (synMatch) {
             console.log(`[Realtime Pipeline] Layer B Instant Match: ${synMatch.emit}`);
             commitOnboardingAnswer(currentStep.step, rawSpeech, synMatch.emit);
             return;
         }
      }
      
      // Silence trigger for fallback matching
      const timeout = setTimeout(async () => {
         stopListening();
         
         if (currentStepIndex === 4) {
            commitOnboardingAnswer(currentStep.step, rawSpeech, rawSpeech);
            return;
         }

         setUIState('processing_match');
         setFeedbackMsg("A compreender resposta...");

         // LAYER C (OpenAI)
         try {
            const apiReq = await fetch('/api/match', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ userVoice: rawSpeech, validOptions: currentStep.chips, stepQuestion: currentStep.question })
            });
            const data = await apiReq.json();
            
            if (data.matchedOptionId && data.matchedOptionId !== 'NO_MATCH' && currentStep.chips.includes(data.matchedOptionId) && data.confidence !== 'low') {
                console.log(`[Validation Pipeline] Layer C AI Match: ${data.matchedOptionId}`);
                commitOnboardingAnswer(currentStep.step, rawSpeech, data.matchedOptionId);
                return;
            }
         } catch (e) {
            console.error('[Validation Pipeline] Layer C block fail', e);
         }

         // FAILURE - NO MATCH
         console.log(`[Validation Pipeline] Failed all layers for: ${rawSpeech}. Waiting for precise retry.`);
         setUIState('match_fail');
         setFeedbackMsg("Ainda estou nesta pergunta. Podes dizer qual das opções ou tocar diretamente.");
         manualSetTranscript(""); 
         
         speak("Não relacionei essa resposta com as opções. Podes escolher uma das que vês no ecrã?", 
           () => setUIState('speaking'),
           () => { setFeedbackMsg(""); setUIState('listening'); startListening(); },
           () => { setUIState('tts_failed'); }
         );

      }, 1800); 

      return () => clearTimeout(timeout);
   }, [voiceTranscript, isListening, mode, currentStepIndex]);

   return (
      <div className="audio-live-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '16px 0', alignItems: 'center' }}>
         <h2 className="question-text" style={{ textAlign: 'center', marginBottom: 24 }}>
           {currentStep.question}
         </h2>
         
         {/* Top Feedback Bar showing HONEST states */}
         <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {uIState === 'booting' && <></>}
            {uIState === 'needs_user_gesture' && <></>}
            {uIState === 'tts_failed' && <div style={{ color: '#ef4444', fontWeight: 600, fontSize:'0.9rem' }}>Não consegui usar a voz. Podes tocar numa opção.</div>}
            {uIState === 'speaking' && <div style={{ color: '#3b82f6', fontWeight: 600 }}>A Falar...</div>}
            {uIState === 'listening' && <div style={{ color: '#ef4444', fontWeight: 600 }}>Estou a ouvir...</div>}
            {uIState === 'processing_match' && <div style={{ color: '#d97706', fontWeight: 600 }}>A processar a tua resposta...</div>}
            {uIState === 'match_success' && <div style={{ color: '#22c55e', fontWeight: 600 }}>Percebi.</div>}
            {uIState === 'match_fail' && <div style={{ color: '#ef4444', fontSize: '0.9rem', textAlign: 'center' }}>{feedbackMsg}</div>}
         </div>

         {/* HONEST BLOCKER for Step 1 missing Gesture */}
         {uIState === 'needs_user_gesture' && (
             <div style={{ marginBottom: '24px' }}>
                 <button 
                    onClick={() => fireTTSLoop()}
                    className="btn-primary"
                    style={{ background: '#3b82f6', border: 'none', padding: '16px 32px', borderRadius: '32px', color: '#fff', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)' }}
                 >
                    🎙️ Toca para iniciar conversa
                 </button>
             </div>
         )}

         {/* Step 5 Giant Microphone fallback */}
         {mode === 'conversation' && currentStepIndex === 4 && uIState !== 'needs_user_gesture' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
               <button 
                  onClick={toggleListening}
                  disabled={!isSupported || isProcessing || uIState === 'processing_match'}
                  style={{
                     width: '100px', height: '100px', borderRadius: '50%',
                     border: 'none',
                     background: uIState === 'listening' ? '#ef4444' : '#0f172a',
                     color: '#fff', fontSize: '2rem', cursor: 'pointer',
                     boxShadow: uIState === 'listening' ? '0 0 24px rgba(239, 68, 68, 0.4)' : '0 8px 16px rgba(15, 23, 42, 0.2)',
                     transition: '0.2s all'
                  }}
               >
                  🎙️
               </button>
               <div style={{ textAlign: 'center', marginTop: '16px', color: uIState === 'listening' ? '#ef4444' : '#64748b', fontWeight: uIState === 'listening' ? 'bold' : 'normal' }}>
                   {uIState === 'listening' ? 'Estou a ouvir a resposta final...' : 'Podes clicar e falar livremente'}
               </div>
            </div>
         )}
         
         {/* Live Transcript Display */}
         {mode === 'conversation' && voiceTranscript && uIState !== 'match_success' && uIState !== 'match_fail' && (
             <div style={{ width: '100%', maxWidth: '400px', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                 <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', fontStyle: 'italic', textAlign: 'center' }}>
                    "{voiceTranscript}"
                 </p>
             </div>
         )}

         {/* Context Chips (Always available as safe fallbacks regardless of TTS/STT failure) */}
         <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 500, marginTop: '8px' }}>
             {currentStep.chips.map(chipText => {
                const isMatched = matchedChip === chipText;
                return (
                   <button 
                     key={chipText} 
                     disabled={uIState === 'match_success' || uIState === 'processing_match'}
                     onClick={() => commitOnboardingAnswer(currentStep.step, `<Toque Direto>`, chipText)}
                     style={{ 
                        padding: '12px 20px', 
                        background: isMatched ? '#22c55e' : '#e2e8f0', 
                        color: isMatched ? '#fff' : '#334155', 
                        border: 'none', 
                        borderRadius: '24px', 
                        cursor: 'pointer', 
                        fontSize: '0.9rem',
                        fontWeight: isMatched ? 700 : 500,
                        transform: isMatched ? 'scale(1.05)' : 'scale(1)',
                        transition: '0.2s all'
                     }}
                   >
                      {chipText}
                   </button>
                );
             })}
         </div>
      </div>
   );
}
