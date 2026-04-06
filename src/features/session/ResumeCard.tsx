import { useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';

export const ResumeCard = ({ onResume, onReset }: { onResume: () => void, onReset: () => void }) => {
  const { updatedAt, mode, phase, transcriptHistory, dominantHypothesis, unresolvedQuestions, fearSignals, costSignals } = useSessionStore();
  const [showHistory, setShowHistory] = useState(false);

  const lastActiveDate = new Date(updatedAt).toLocaleDateString('pt-PT', { 
    weekday: 'long', hour: '2-digit', minute: '2-digit' 
  });

  const clearPoints = [
    dominantHypothesis && `Padrão principal focado: ${dominantHypothesis}`,
    costSignals.length > 0 && `Custos mapeados: ${costSignals.length}`,
    fearSignals.length > 0 && `Medos assinalados: ${fearSignals.length}`,
  ].filter(Boolean);

  const openPoints = unresolvedQuestions;

  return (
    <div style={{
      padding: '24px',
      background: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      maxWidth: '600px',
      margin: '0 auto',
      textAlign: 'left'
    }}>
      <h3 style={{ marginTop: 0 }}>Sessão Anterior Encontrada</h3>
      <p style={{ fontSize: '0.9em', color: '#64748b' }}>
        Última atividade: {lastActiveDate} | Modo: {mode} | Fase: {phase.replace('_', ' ')}
      </p>

      {clearPoints.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <strong>O que já temos claro:</strong>
          <ul style={{ fontSize: '0.9em', color: '#334155', paddingLeft: '20px' }}>
            {clearPoints.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {openPoints.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <strong>O que ainda falta perceber:</strong>
          <ul style={{ fontSize: '0.9em', color: '#334155', paddingLeft: '20px' }}>
            {openPoints.slice(0, 2).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {showHistory && (
        <div style={{ 
          marginTop: '24px', 
          maxHeight: '200px', 
          overflowY: 'auto', 
          padding: '12px', 
          background: '#fff', 
          border: '1px solid #cbd5e1', 
          borderRadius: '4px' 
        }}>
          {transcriptHistory.map((msg, i) => (
             <div key={i} style={{ marginBottom: 12, color: msg.role === 'human' ? '#0f172a' : '#475569' }}>
               <strong style={{ fontSize: '0.8em', textTransform: 'uppercase' }}>{msg.role}:</strong>
               <p style={{ margin: '4px 0 0 0', fontSize: '0.9em' }}>{msg.text}</p>
             </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '32px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button 
          onClick={onResume}
          style={{ padding: '12px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Retomar Exploração
        </button>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          style={{ padding: '12px 24px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
        >
          {showHistory ? 'Ocultar Conversa' : 'Ver Conversa Anterior'}
        </button>
        <button 
          onClick={onReset}
          style={{ padding: '12px 24px', background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Começar de Novo
        </button>
      </div>
    </div>
  );
};
