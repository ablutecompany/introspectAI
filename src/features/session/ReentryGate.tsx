/**
 * ReentryGate.tsx
 *
 * Sprint 5: Ecrã de entrada quando existe um caso retomável.
 * Sprint 6: Enriquecido com linha de delta e linha de abertura
 *   baseadas no histórico de mudança calculado no follow-up anterior.
 *
 * Apresenta ao utilizador uma escolha clara e humana:
 * - "Continuar de onde fiquei" (entra em FOLLOW_UP_REENTRY)
 * - "Começar uma nova exploração" (reset limpo)
 *
 * Nunca mente sobre o que está guardado.
 * Nunca usa linguagem de backend ou tecnocrática.
 *
 * Ponto de extensão: quando existir auth, mostrar aqui
 * a continuidade cross-device de forma honesta.
 */

import { useSessionStore } from '../../store/useSessionStore';
import { buildEnrichedResumeSummary } from '../../engine/reentry/reentryEngine';

interface ReentryGateProps {
  onContinue: () => void;
  onStartFresh: () => void;
}

export function ReentryGate({ onContinue, onStartFresh }: ReentryGateProps) {
  const state = useSessionStore.getState();
  const summary = buildEnrichedResumeSummary(state);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: 520,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {/* Cabeçalho */}
        <div>
          <p style={{
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            Última exploração — {summary.lastSeenLabel} • <span style={{color: 'var(--accent-text)'}}>{summary.caseStateLabel}</span>
          </p>
          <h1 style={{ fontSize: '1.5rem', lineHeight: 1.3, color: 'var(--text-main)', margin: 0 }}>
            {/* Sprint 10C: Wording mais humano e pessoal */}
            Na última vez, ficaste a explorar "{summary.focusLabel}".
          </h1>
        </div>

        {/* Cartão de resumo do caso */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          {summary.hypothesisLabel && (
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                A hipótese em trabalho era
              </p>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                "{summary.hypothesisLabel}"
              </p>
            </div>
          )}

          {summary.pendingWork && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Tinhas ficado de observar
              </p>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--accent-text)' }}>
                {summary.pendingWork}
              </p>
            </div>
          )}

          {!summary.hypothesisLabel && !summary.pendingWork && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              A exploração estava em curso mas ainda sem hipótese confirmada.
            </p>
          )}

          {/* Sprint 6: Linha de delta (se houver histórico de mudança) */}
          {summary.deltaLine && (
            <div style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: 14,
            }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Da última vez para cá...
              </p>
              <p style={{
                margin: 0,
                fontSize: '0.85rem',
                color: 'var(--accent-text)',
                lineHeight: 1.5,
                fontStyle: 'italic',
              }}>
                "{summary.deltaLine}"
              </p>
            </div>
          )}

          {/* Indicador honesto de continuidade local */}
          <div style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Guardado neste browser
            </span>
            {summary.sessionCount > 1 && (
              <span style={{
                fontSize: '0.72rem',
                background: 'var(--accent-base)',
                color: 'var(--text-muted)',
                padding: '2px 8px',
                borderRadius: 20,
              }}>
                {summary.sessionCount - 1} {summary.sessionCount - 1 === 1 ? 'sessão anterior' : 'sessões anteriores'}
              </span>
            )}
          </div>
        </div>

        {/* Sprint 6: Linha de abertura da sessão atual (baseada na inferência de ajuste) */}
        {summary.sessionCount > 1 && (
          <p style={{
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}>
            {summary.sessionOpeningLine}
          </p>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            id="btn-continue-case"
            className="btn-primary"
            onClick={onContinue}
            style={{ width: '100%', padding: '14px 24px', fontSize: '1rem' }}
          >
            Continuar de onde fiquei
          </button>
          <button
            id="btn-start-fresh"
            onClick={onStartFresh}
            style={{
              width: '100%',
              padding: '12px 24px',
              fontSize: '0.9rem',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-muted)';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            Começar uma nova exploração
          </button>
        </div>
      </div>
    </div>
  );
}
