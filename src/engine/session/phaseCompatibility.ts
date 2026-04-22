import type { InternalStatePhase, SessionStage } from '../../types/internalState';

/**
 * Deduz o novo SessionStage longitudinal a partir da Phase antiga legacy.
 * Isto permite que a App ainda assente no TriageFlow, mas o motor deduza
 * em que etapa longitudinal estamos.
 */
export function inferSessionStageFromLegacyPhase(phase: InternalStatePhase): SessionStage {
  switch (phase) {
    case 'TRIAGE':
      return 'ENTRY_ORIENTATION';
    case 'LATENT_READING_DISPLAY':
      return 'EMERGENT_READING'; // Provisório até à próxima fase
    case 'CONTINUATION_ACTIVE':
      return 'PROVISIONAL_FOCUS'; // Assumimos exploração
    case 'CLOSE_NOW':
      return 'CLOSE_NOW';
    default:
      return 'ENTRY_ORIENTATION';
  }
}

/**
 * Faz a operação inversa para garantir fallbacks para o App.tsx (que
 * por agora ainda faz render com base no InternalStatePhase).
 */
export function inferLegacyPhaseFromSessionStage(stage: SessionStage): InternalStatePhase {
  switch (stage) {
    case 'ENTRY_ORIENTATION':
      return 'TRIAGE';
    case 'PROVISIONAL_FOCUS':
    case 'DISCRIMINATIVE_EXPLORATION': // Se usarmos novos modos no futuro, caem aqui
      return 'CONTINUATION_ACTIVE';
    case 'EMERGENT_READING':
      return 'LATENT_READING_DISPLAY';
    case 'FOLLOW_UP_REENTRY':
      // Sprint 5: FOLLOW_UP_REENTRY está agora activo — mapeia para CONTINUATION_ACTIVE
      // para que o App.tsx renderize o fluxo de follow-up em vez de fechar.
      return 'CONTINUATION_ACTIVE';
    case 'WORK_ASSIGNMENT':
    case 'CLOSE_NOW':
      return 'CLOSE_NOW';
    default:
      return 'TRIAGE';
  }
}
