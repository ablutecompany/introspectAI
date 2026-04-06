import { useState, useEffect } from 'react';
import { useTTS } from '../../hooks/useTTS';
import { useSpeechInput } from '../../hooks/useSpeechInput';

const ONBOARDING_STEPS = [
  {
    step: 1,
    question: "Antes de começarmos, ajuda-me a perceber onde está o peso maior neste momento.",
    chips: ["Cansaço / sem energia", "Ansiedade / constante", "Problemas com outras pessoas", "Sinto-me bloqueado", "Ando perdido", "Não sei bem explicar"],
    synonyms: [
       { match: ['cansaço', 'cansado', 'energia', 'exausto', 'esgotado', 'fadiga'], emit: 'Cansaço / sem energia' },
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
       { match: ['mais ou menos', 'meio', 'razoável', 'médio', 'pouco'], emit: 'Mais ou menos' },
       { match: ['vai e vem', 'às vezes', 'depende', 'oscila', 'fases'], emit: 'Vai e vem' },
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
       { match: ['depende', 'varia', 'variável'], emit: 'Depende' },
       { match: ['não sei', 'difícil dizer'], emit: 'Não sei' }
    ]
  },
  {
    step: 4,
    question: "Isto pesa-te mais como quê?",
    chips: ["Cansaço", "Medo", "Pressão", "Confusão", "Mistura de tudo", "Não sei explicar"],
    synonyms: [
       { match: ['cansaço', 'corpo', 'fadiga', 'dormir'], emit: 'Cansaço' },
       { match: ['medo', 'receio', 'assustado', 'pânico', 'fobia'], emit: 'Medo' },
       { match: ['pressão', 'peso', 'cobrança', 'responsabilidade', 'stress'], emit: 'Pressão' },
       { match: ['confusão', 'dúvida', 'vazio', 'pensamento'], emit: 'Confusão' },
       { match: ['mistura', 'tudo', 'vários', 'combo', 'tudo misturado'], emit: 'Mistura de tudo' },
       { match: ['não sei', 'difícil'], emit: 'Não sei explicar' }
    ]
  },
  {
    step: 5,
    question: "Se tivesses de me dar um exemplo simples, o que é que mais mostra isso no teu dia-a-dia?",
    chips: ["No trabalho", "Em casa", "Com pessoas", "Dentro da cabeça", "Prefiro dizer por voz", "Não sei"],
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
   const { speak, stop } = useTTS();
   const { isListening, startListening, stopListening, toggleListening, manualSetTranscript, transcript: voiceTranscript, isSupported } = useSpeechInput();
   
   const [feedbackMsg, setFeedbackMsg] = useState("");
   const currentStep = ONBOARDING_STEPS[currentStepIndex];

   // TTS on step change
   useEffect(() => {
     if (mode === 'conversation' && currentStep.question) {
       speak(currentStep.question);
     }
     return () => stop();
   }, [currentStepIndex, mode, speak, stop, currentStep.question]);

   // Handle Semantic Matching and Auto-Submit over Voice
   useEffect(() => {
      // Don't trigger auto validations if not in conversation or not listening or transcript is too short
      if (mode !== 'conversation' || !isListening || voiceTranscript.trim().length < 3) return;
      
      const timeout = setTimeout(() => {
         const finalTxt = voiceTranscript.toLowerCase();
         stopListening(); // Always freeze mic on pauses
         
         // If Step 5 (index 4), it's open speech. Accept anything verbatim.
         if (currentStepIndex === 4) {
            handleSelection(voiceTranscript);
            return;
         }

         // If Steps 1 to 4, pattern match explicitly against accepted inputs
         const matchObj = currentStep.synonyms.find(syn => 
            syn.match.some(m => finalTxt.includes(m))
         );
         
         if (matchObj) {
            setFeedbackMsg("");
            handleSelection(matchObj.emit);
         } else {
            setFeedbackMsg("Ainda estou nesta pergunta. Podes tocar numa opção ou usar termos mais curtos.");
            speak("Não percebi bem a reposta. Podes tocar na opção que reflete o que sentes?");
            manualSetTranscript(""); // reset bad transcript
         }
      }, 2000); // 2 second pause trigger

      return () => clearTimeout(timeout);
   }, [voiceTranscript, isListening, mode, currentStepIndex]);

   const handleSelection = (answer: string) => {
     const newBuffer = [...buffer, answer];
     setFeedbackMsg(""); // Clear errors on success
     if (currentStepIndex === ONBOARDING_STEPS.length - 1) {
       // Completed all 5 steps! Stitch and submit directly backward to the Conductor inside App.tsx
       const finalTranscript = `[User Context Buffer]: Peso principal: ${newBuffer[0]}. Intensidade: ${newBuffer[1]}. Momento: ${newBuffer[2]}. Tipo de peso: ${newBuffer[3]}. Exemplo dominante: ${newBuffer[4]}`;
       onComplete(finalTranscript);
     } else {
       setBuffer(newBuffer);
       setCurrentStepIndex(prev => prev + 1);
       manualSetTranscript(""); // Clean the input view for the next step UI
     }
   };

   return (
      <div className="audio-live-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '32px 0', alignItems: 'center' }}>
         <h2 className="question-text" style={{ textAlign: 'center', marginBottom: 24 }}>
           {currentStep.question}
         </h2>
         
         {/* Semantic Warning Error Text */}
         <div style={{ height: '24px', marginBottom: '8px' }}>
            <p style={{ margin: 0, color: '#ef4444', fontSize: '0.9rem', textAlign: 'center', transition: '0.2s opacity', opacity: feedbackMsg ? 1 : 0 }}>
               {feedbackMsg}
            </p>
         </div>

         {/* Only show Open Mic prominently if step 5, otherwise keep hidden to enforce chips/guidance! */}
         {mode === 'conversation' && currentStepIndex === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
               <button 
                  onClick={toggleListening}
                  disabled={!isSupported || isProcessing}
                  style={{
                     width: '100px', height: '100px', borderRadius: '50%',
                     border: 'none',
                     background: isListening ? '#ef4444' : '#0f172a',
                     color: '#fff', fontSize: '2rem', cursor: 'pointer',
                     boxShadow: isListening ? '0 0 24px rgba(239, 68, 68, 0.4)' : '0 8px 16px rgba(15, 23, 42, 0.2)',
                     transition: '0.2s all'
                  }}
               >
                  🎙️
               </button>
               <div style={{ textAlign: 'center', marginTop: '16px', color: isListening ? '#ef4444' : '#64748b', fontWeight: isListening ? 'bold' : 'normal' }}>
                   {isListening ? 'Estou a ouvir a resposta...' : 'Ou clica aqui para falar sem limites'}
               </div>
               
               {voiceTranscript && (
                  <div style={{ marginTop: 16, background: '#f8fafc', padding: '12px', borderRadius: '8px', maxWidth: '300px' }}>
                     <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center' }}>"{voiceTranscript}"</p>
                  </div>
               )}
            </div>
         )}
         
         {/* Live display of the transcript even if we are strictly taking semantic matches in 1-4 */}
         {mode === 'conversation' && currentStepIndex < 4 && isListening && voiceTranscript && (
             <div style={{ width: '100%', maxWidth: '300px', background: '#fee2e2', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #fecaca' }}>
                 <p style={{ margin: 0, fontSize: '0.85rem', color: '#b91c1c', fontStyle: 'italic', textAlign: 'center' }}>
                    "{voiceTranscript}"
                 </p>
                 <div style={{ fontSize: '0.7rem', color: '#ef4444', textAlign: 'center', marginTop: 4 }}>
                    A validar se corresponde a uma opção...
                 </div>
             </div>
         )}

         {/* Context Chips Aligned to Question */}
         <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 500, marginTop: '8px' }}>
             {currentStep.chips.map(chipText => (
                <button 
                  key={chipText} 
                  disabled={isProcessing}
                  onClick={() => {
                     // If step 5 and "Prefiro dizer por voz", simply trigger native start
                     if (chipText === 'Prefiro dizer por voz') {
                        if (!isListening) startListening();
                        return;
                     }
                     handleSelection(chipText);
                  }}
                  style={{ 
                     padding: '12px 20px', 
                     background: '#e2e8f0', 
                     color: '#334155', 
                     border: 'none', 
                     borderRadius: '24px', 
                     cursor: 'pointer', 
                     fontSize: '0.9rem',
                     fontWeight: 500
                  }}
                >
                   {chipText}
                </button>
             ))}
         </div>
         
         {/* Manual Mic Trigger for steps 1-4 if they really want to force voice instead of chips */}
         {mode === 'conversation' && currentStepIndex < 4 && isSupported && (
             <div style={{ marginTop: '16px' }}>
                 <button 
                    onClick={toggleListening}
                    disabled={isProcessing || isListening}
                    style={{
                       background: 'transparent',
                       border: 'none',
                       color: isListening ? '#ef4444' : '#94a3b8',
                       fontSize: '0.85rem',
                       cursor: 'pointer',
                       display: 'flex',
                       alignItems: 'center',
                       gap: '6px'
                    }}
                 >
                    🎙️ {isListening ? 'A ouvir...' : 'Responder por voz'}
                 </button>
             </div>
         )}
      </div>
   );
}
