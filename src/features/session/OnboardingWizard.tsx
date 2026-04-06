import { useState, useEffect } from 'react';
import { useTTS } from '../../hooks/useTTS';
import { useSpeechInput } from '../../hooks/useSpeechInput';

const ONBOARDING_STEPS = [
  {
    step: 1,
    question: "Antes de começarmos, ajuda-me a perceber onde está o peso maior neste momento.",
    chips: ["Cansaço / sem energia", "Ansiedade / constante", "Problemas com outras pessoas", "Sinto-me bloqueado", "Ando perdido", "Não sei bem explicar"]
  },
  {
    step: 2,
    question: "Isto tem-te pesado quanto?",
    chips: ["Muito", "Bastante", "Mais ou menos", "Vai e vem", "É difícil dizer"]
  },
  {
    step: 3,
    question: "Notas isto mais em que altura?",
    chips: ["Ao acordar", "Durante o dia", "À noite", "Quase sempre", "Depende", "Não sei"]
  },
  {
    step: 4,
    question: "Isto pesa-te mais como quê?",
    chips: ["Cansaço", "Medo", "Pressão", "Confusão", "Mistura de tudo", "Não sei explicar"]
  },
  {
    step: 5,
    question: "Se tivesses de me dar um exemplo simples, o que é que mais mostra isso no teu dia-a-dia?",
    chips: ["No trabalho", "Em casa", "Com pessoas", "Dentro da cabeça", "Prefiro dizer por voz", "Não sei"]
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
   const { isListening, toggleListening, transcript: voiceTranscript, isSupported } = useSpeechInput();
   
   const currentStep = ONBOARDING_STEPS[currentStepIndex];

   useEffect(() => {
     if (mode === 'conversation' && currentStep.question) {
       speak(currentStep.question);
     }
     return () => stop();
   }, [currentStepIndex, mode, speak, stop, currentStep.question]);

   const handleSelection = (answer: string) => {
     const newBuffer = [...buffer, answer];
     if (currentStepIndex === ONBOARDING_STEPS.length - 1) {
       // Completed, stitch and submit
       const finalTranscript = `[User Context Buffer]: Peso principal: ${newBuffer[0]}. Intensidade: ${newBuffer[1]}. Momento: ${newBuffer[2]}. Tipo de peso: ${newBuffer[3]}. Exemplo dominante: ${newBuffer[4]}`;
       onComplete(finalTranscript);
     } else {
       setBuffer(newBuffer);
       setCurrentStepIndex(prev => prev + 1);
     }
   };

   // If voice is provided instead of touching
   const handleVoiceSubmit = () => {
      if (voiceTranscript.trim()) {
         handleSelection(voiceTranscript);
      }
   };

   return (
      <div className="audio-live-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '32px 0', alignItems: 'center' }}>
         <h2 className="question-text" style={{ textAlign: 'center', marginBottom: 24 }}>
           {currentStep.question}
         </h2>
         
         {/* Big Voice Mic Support inside Onboarding (Crucial for Step 5 or fallback) */}
         {mode === 'conversation' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <button 
                  onClick={toggleListening}
                  disabled={!isSupported || isProcessing}
                  style={{
                     width: '80px', height: '80px', borderRadius: '50%',
                     border: 'none',
                     background: isListening ? '#ef4444' : '#0f172a',
                     color: '#fff', fontSize: '1.5rem', cursor: 'pointer',
                     boxShadow: isListening ? '0 0 24px rgba(239, 68, 68, 0.4)' : '0 8px 16px rgba(15, 23, 42, 0.2)',
                     transition: '0.2s all'
                  }}
               >
                  🎙
               </button>
               {voiceTranscript && (
                  <div style={{ marginTop: 16, background: '#f8fafc', padding: '12px', borderRadius: '8px', maxWidth: '300px' }}>
                     <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center' }}>"{voiceTranscript}"</p>
                     <button onClick={handleVoiceSubmit} disabled={isProcessing} style={{ marginTop: 8, width: '100%', padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Avançar com voz
                     </button>
                  </div>
               )}
            </div>
         )}

         {/* Context Chips Aligned to Question */}
         <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 500, marginTop: '24px' }}>
             {currentStep.chips.map(chipText => (
                   <button 
                     key={chipText} 
                     disabled={isProcessing}
                     onClick={() => {
                        // If step 5 and "Prefiro dizer por voz", explicitly wait for mic
                     if (chipText === 'Prefiro dizer por voz') {
                        if (!isListening) toggleListening();
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
      </div>
   );
}
