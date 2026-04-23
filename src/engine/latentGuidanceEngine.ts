import type { InternalState, FrictionArea } from '../types/internalState';
import { MAPA_LATENTE, MAPA_ORIENTACAO, MODULADORES_OBJETIVO, buildLatentText, buildGuidanceText, buildClosingLine } from './latentGuidanceTemplates';

// A mapping to resolve human readable labels for secondary Areas.
const AREA_LABELS: Record<FrictionArea, string> = {
  A: 'sintomatologia e resposta de corpo',
  B: 'exaustão e recuperação energética',
  C: 'mente, ativação ansiosa e tensão',
  D: 'caos prático e sobrecarga',
  E: 'conflito e campo relacional',
  F: 'sentido, eixo e peso de decisões',
  G: 'múltiplas tensões colidindo'
};

export interface MotorOutput {
  provisionalFocusLabel: string;
  provisionalHypothesisParagraph: string;
  guidanceParagraph: string;
  closingLine: string;
  needsDiscrimination: boolean;
}

export function buildLatentAndGuidanceDeterministic(state: InternalState): MotorOutput {
  const triage = state.triageState;
  const area = triage?.primary_problem_area ?? 'C'; // fallback para segurança
  const secArea = triage?.secondary_problem_area;
  const goal = triage?.immediate_goal ?? 'C'; // fallback

  const isEarlyClose = state.governance.shouldCloseNow && state.governance.lastGovernanceReason === 'meta_conversation';
  const isDiffuse = triage?.detail_level === 'reserved_diffuse';

  const mode = isEarlyClose ? 'MODE_EARLY_CLOSE' : (isDiffuse ? 'MODE_PROVISIONAL' : 'MODE_STANDARD');

  // Mapeamentos
  const safeArea = area;
  
  const latentData = MAPA_LATENTE[safeArea];
  const guidanceData = MAPA_ORIENTACAO[safeArea];
  const goalModulator = MODULADORES_OBJETIVO[goal];

  const surfaceLabel = AREA_LABELS[safeArea] || 'stress genérico';
  const secondaryLabel = secArea ? AREA_LABELS[secArea as FrictionArea] : null;

  const latent = buildLatentText(mode, surfaceLabel, latentData, secondaryLabel);
  const guidance = buildGuidanceText(mode, guidanceData, goalModulator);
  const fecho = buildClosingLine();

  const needsDiscrimination = !!secArea || isDiffuse;

  return {
    provisionalFocusLabel: surfaceLabel,
    provisionalHypothesisParagraph: latent,
    guidanceParagraph: guidance,
    closingLine: fecho,
    needsDiscrimination
  };
}
