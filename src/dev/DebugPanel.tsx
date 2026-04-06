import React, { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { EcosystemMapper } from '../engine/ecosystemProfile';
import { OutcomeEngine } from '../engine/outcomeRules';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const state = useSessionStore();
  
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{ position: 'fixed', bottom: 10, right: 10, padding: '6px 12px', fontSize: 11, background: '#111', color: '#0f0', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', zIndex: 9999 }}
      >
        DEV ON
      </button>
    );
  }

  const profile = EcosystemMapper.generateProfile(state);
  let currentOutcome;
  try {
     currentOutcome = OutcomeEngine.calculateOutcome(state);
  } catch (e) {
     currentOutcome = { level: 'error', type: 'error' };
  }

  return (
    <div style={{ position: 'fixed', bottom: 10, right: 10, width: 340, maxHeight: '85vh', overflowY: 'auto', background: '#0a0a0a', border: '1px solid #333', borderRadius: 8, padding: '16px', color: '#0f0', fontFamily: 'monospace', fontSize: 12, zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid #333', paddingBottom: 8 }}>
         <strong><span style={{color: '#fff'}}>_introspect</span> DEV PANEL</strong>
         <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', color: '#f00', border: 'none', cursor: 'pointer', fontSize: 10}}>FECHAR</button>
       </div>
       
       <div style={{ marginBottom: 12 }}>
         <div style={{color: '#666'}}>PHASE:</div> 
         <span style={{color: '#fff'}}>{state.phase} (Turno {state.turnIndex})</span>
       </div>

       <div style={{ marginBottom: 12 }}>
         <div style={{color: '#666'}}>HYPOTHESIS:</div> 
         <div>D: {state.dominantHypothesis || '---'}</div>
         <div>S: {state.secondaryHypothesis || '---'}</div>
       </div>

       <div style={{ marginBottom: 12 }}>
         <div style={{color: '#666'}}>SIGNALS PULL:</div> 
         <div>Costs: {state.costSignals.length}</div>
         <div>Fears: {state.fearSignals.length}</div>
         <div>Mechs: {state.mechanismSignals.length}</div>
       </div>

       <div style={{ marginBottom: 12 }}>
         <div style={{color: '#666'}}>CONFIDENCE / READINESS:</div> 
         <div>C: {state.confidenceLevel}</div>
         <div>R: Score {state.outcomeReadinessScore}</div>
       </div>
       
       <div style={{ marginBottom: 12 }}>
         <div style={{color: '#666'}}>FRICTION FLAGS:</div> 
         <div>Consecutive Vague: {state.consecutiveVagueAnswers}</div>
         <div>Consecutive Deflev: {state.consecutiveDeflectiveAnswers}</div>
       </div>

       <div style={{ marginBottom: 12 }}>
         <div style={{color: '#666'}}>OUTCOME ENGINE:</div> 
         <div style={{color: '#fbbf24'}}>Level: {currentOutcome.level} ({currentOutcome.type})</div>
       </div>

       <div style={{ marginBottom: 12 }}>
         <div style={{color: '#666'}}>ECOSYSTEM PROFILE (wearLevel):</div> 
         <div style={{ fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#a1a1aa' }}>
           {profile.wearLevel ? JSON.stringify(profile.wearLevel, null, 2) : 'null'}
         </div>
       </div>
    </div>
  );
}
