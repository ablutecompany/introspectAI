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
       { match: ['ansioso', 'nervoso', 'cabeça', 'pensar', 'stress'], emit: 'Ansiedade / constante' },
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
       { match: ['imenso', 'fortemente', 'absurdo', 'péssimo', 'horrível', 'pesado'], emit: 'Muito' },
       { match: ['um bocado', 'algum', 'significativo'], emit: 'Bastante' },
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
   const { speak, stop: stopTTS } = useTTS();
   const { isListening, startListening, stopListening, toggleListening, manualSetTranscript, transcript: voiceTranscript, isSupported } = useSpeechInput();
   
   const [uIState, setUIState] = useState<'speaking' | 'listening' | 'processing_match' | 'match_success' | 'match_fail' | 'idle'>('idle');
   const [feedbackMsg, setFeedbackMsg] = useState("");
   const [matchedChip, setMatchedChip] = useState<string | null>(null);

   const currentStep = ONBOARDING_STEPS[currentStepIndex];

   // Normalizer for Layer A
   const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();

   // Core Transition Engine
   useEffect(() => {
     if (mode === 'conversation' && currentStep.question) {
       setUIState('speaking');
       speak(currentStep.question, () => {
          // AUTO START LISTENING ONCE INSTRUCTIONS FINISH
          if (mode === 'conversation' && isSupported) {
             setUIState('listening');
             startListening();
          } else {
             setUIState('idle');
          }
       });
     }
     return () => stopTTS();
   }, [currentStepIndex, mode, speak, stopTTS, startListening, isSupported, currentStep.question]);

   // Handle Semantic Matching and Silence Trigger
   useEffect(() => {
      if (mode !== 'conversation' || !isListening || voiceTranscript.trim().length < 3 || uIState === 'processing_match') return;
      
      const timeout = setTimeout(async () => {
         stopListening();
         const rawSpeech = voiceTranscript;
         const normalizedSpeech = normalize(rawSpeech);
         
         // PASS 5: Open Voice Loop
         if (currentStepIndex === 4) {
            handleSelection(rawSpeech);
            return;
         }

         setUIState('processing_match');
         setFeedbackMsg("A compreender resposta...");

         console.log(`[Validation Pipeline] Step ${currentStep.step} received: "${rawSpeech}"`);

         // LAYER A: Exact Normalized Match
         let layerAMatch = currentStep.chips.find(c => normalize(c) === normalizedSpeech);
         if (layerAMatch) {
             console.log(`[Validation Pipeline] Layer A Match: ${layerAMatch}`);
             executeMatchAnimation(layerAMatch);
             return;
         }

         // LAYER B: Synonyms Match
         const matchObj = currentStep.synonyms.find(syn => 
            syn.match.some(m => normalizedSpeech.includes(normalize(m)))
         );
         if (matchObj) {
            console.log(`[Validation Pipeline] Layer B Match: ${matchObj.emit}`);
            executeMatchAnimation(matchObj.emit);
            return;
         }

         // LAYER C: OpenAI Strict Schema Matching
         console.log(`[Validation Pipeline] Layer C Active. Asking OpenAI...`);
         try {
            const apiReq = await fetch('/api/match', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  userVoice: rawSpeech,
                  validOptions: currentStep.chips,
                  stepQuestion: currentStep.question
               }) // Ensure step info limits hallucinations
            });
            const data = await apiReq.json();
            console.log(`[Validation Pipeline] Layer C Result:`, data);
            
            if (data.matchedOptionId && data.matchedOptionId !== 'NO_MATCH' && currentStep.chips.includes(data.matchedOptionId)) {
                if (data.confidence !== 'low') {
                    executeMatchAnimation(data.matchedOptionId);
                    return;
                }
            }
         } catch (e) {
            console.error('[Validation Pipeline] Layer C failed catastrophically', e);
         }

         // FAILURE - NO MATCH
         console.log(`[Validation Pipeline] Result: NO MATCH`);
         setUIState('match_fail');
         setFeedbackMsg("Ainda estou nesta pergunta. Podes dizer qual das opções ou tocar diretamente.");
         manualSetTranscript(""); // Clean error state
         speak("Não relacionei essa resposta com as opções. Podes escolher uma das que vês no ecrã?", () => {
             // Restart listening
             setFeedbackMsg("");
             setUIState('listening');
             startListening();
         });

      }, 1800); // 1.8s pause trigger means snappy responses

      return () => clearTimeout(timeout);
   }, [voiceTranscript, isListening, mode, currentStepIndex]);

   const executeMatchAnimation = (resolvedChip: string) => {
      setMatchedChip(resolvedChip);
      setUIState('match_success');
      setFeedbackMsg("Percebi.");
      manualSetTranscript("");
      
      setTimeout(() => {
         setMatchedChip(null);
         handleSelection(resolvedChip);
      }, 1000); // Wait 1s so the user sees the green chip highlight
   };

   const handleSelection = (answer: string) => {
     const newBuffer = [...buffer, answer];
     setFeedbackMsg(""); 
     setUIState('idle');
     stopListening();
     
     if (currentStepIndex === ONBOARDING_STEPS.length - 1) {
       // Complete!
       const finalTranscript = `[User Context Buffer]: Peso principal: ${newBuffer[0]}. Intensidade: ${newBuffer[1]}. Momento: ${newBuffer[2]}. Tipo de peso: ${newBuffer[3]}. Exemplo dominante: ${newBuffer[4]}`;
       onComplete(finalTranscript);
     } else {
       setBuffer(newBuffer);
       setCurrentStepIndex(prev => prev + 1);
       manualSetTranscript("");
     }
   };

   return (
      <div className="audio-live-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '16px 0', alignItems: 'center' }}>
         <h2 className="question-text" style={{ textAlign: 'center', marginBottom: 24 }}>
           {currentStep.question}
         </h2>
         
         {/* Top Feedback Bar showing exactly what app is doing */}
         <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {uIState === 'speaking' && <div style={{ color: '#3b82f6', fontWeight: 600 }}>A falar...</div>}
            {uIState === 'listening' && <div style={{ color: '#ef4444', fontWeight: 600 }}>Estou a ouvir...</div>}
            {uIState === 'processing_match' && <div style={{ color: '#d97706', fontWeight: 600 }}>A processar a tua resposta...</div>}
            {uIState === 'match_success' && <div style={{ color: '#22c55e', fontWeight: 600 }}>Percebi.</div>}
            {uIState === 'match_fail' && <div style={{ color: '#ef4444', fontSize: '0.9rem', textAlign: 'center' }}>{feedbackMsg}</div>}
         </div>

         {/* Only show Open Mic prominently if step 5, otherwise keep hidden to enforce chips/guidance! */}
         {mode === 'conversation' && currentStepIndex === 4 && (
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
         
         {/* Live display of the transcript smoothly underneath the state */}
         {mode === 'conversation' && voiceTranscript && uIState !== 'match_success' && uIState !== 'match_fail' && (
             <div style={{ width: '100%', maxWidth: '400px', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                 <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', fontStyle: 'italic', textAlign: 'center' }}>
                    "{voiceTranscript}"
                 </p>
             </div>
         )}

         {/* Context Chips Aligned to Question */}
         <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 500, marginTop: '8px' }}>
             {currentStep.chips.map(chipText => {
                const isMatched = matchedChip === chipText;
                return (
                   <button 
                     key={chipText} 
                     disabled={isProcessing || uIState === 'processing_match'}
                     onClick={() => handleSelection(chipText)}
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
