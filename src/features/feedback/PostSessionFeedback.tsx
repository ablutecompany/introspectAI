import { useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';

export const PostSessionFeedback = ({ onComplete }: { onComplete: (feedback: any) => void }) => {
  const { mode } = useSessionStore();
  const [feedback, setFeedback] = useState({
    clarityScore: null as number | null,
    focusScore: null as number | null,
    outcomeUsefulness: null as number | null,
    outcomeGeneric: null as number | null,
    preferredMode: mode,
    wouldUseAgain: null as boolean | null,
    mostConfusing: '',
    mostValuable: ''
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // In production, this would emit to a telemetry service
    console.log('[Telemetry] UX Feedback Submetido: ', feedback);
    setSubmitted(true);
    setTimeout(() => onComplete(feedback), 1000);
  };

  if (submitted) return <div style={{ color: '#10b981', padding: '24px' }}>Obrigado pela tua bússola.</div>;

  return (
    <div style={{ marginTop: '32px', padding: '24px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
      <h3 style={{ marginTop: 0 }}>Terminámos. Como foi a viagem?</h3>
      <p style={{ fontSize: '0.9em', color: '#64748b' }}>
        Apenas com a tua honestidade crível poderemos afinar esta máquina para o mundo real.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
         <label>1. Foi fácil perceber o que te estava a ser perguntado? (1 a 5)
           <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
             {[1,2,3,4,5].map(v => (
               <button key={v} onClick={() => setFeedback({...feedback, clarityScore: v})} 
                 style={{ background: feedback.clarityScore === v ? '#0f172a':'#fff', color: feedback.clarityScore === v ? '#fff':'#000', borderRadius: '50%', width: 36, height: 36, border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                 {v}
               </button>
             ))}
           </div>
         </label>

         <label>2. A conversa manteve-se focada ou senti-la a derivar? (1 = Deriva, 5 = Focada)
           <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
             {[1,2,3,4,5].map(v => (
               <button key={v} onClick={() => setFeedback({...feedback, focusScore: v})} 
                 style={{ background: feedback.focusScore === v ? '#0f172a':'#fff', color: feedback.focusScore === v ? '#fff':'#000', borderRadius: '50%', width: 36, height: 36, border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                 {v}
               </button>
             ))}
           </div>
         </label>
         
         <label>3. O que confundiu ou pareceu mais mecânico na IA?
           <textarea rows={2} style={{ width: '100%', marginTop: '8px', padding: '8px' }} onChange={e => setFeedback({...feedback, mostConfusing: e.target.value})} />
         </label>

         <label>4. O que teve mais valor nesta sessão?
           <textarea rows={2} style={{ width: '100%', marginTop: '8px', padding: '8px' }} onChange={e => setFeedback({...feedback, mostValuable: e.target.value})} />
         </label>

         <button 
           onClick={handleSubmit}
           disabled={!feedback.clarityScore || !feedback.focusScore}
           style={{ marginTop: '16px', padding: '12px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (!feedback.clarityScore || !feedback.focusScore) ? 0.5 : 1 }}
         >
           Submeter Análise
         </button>
      </div>
    </div>
  );
};
