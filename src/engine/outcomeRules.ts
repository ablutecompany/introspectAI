import type { InternalState } from '../types/internalState';

export interface OutcomeResponse {
  level: 0 | 1 | 2 | 3;
  type: 'too_early' | 'provisional' | 'consolidated' | 'final';
  payload: Record<string, string>;
}

export class OutcomeEngine {
  /**
   * Operacionalização Rígida de Outcomes do Nível 0 a 3.
   * Não confia em LLM para estipular o grau da leitura; avalia a densidade algorítmica real.
   */
  static calculateOutcome(state: InternalState): OutcomeResponse {
    const hasCosts = state.costSignals.length > 0;
    const hasFear = state.fearSignals.length > 0;
    const hasMechanism = state.mechanismSignals.length > 0;
    const hasDesire = state.desiredLifeSignals.length > 0;
    const hasDominantHypothesis = !!state.dominantHypothesis;
    
    // NÍVEL 0 — Ainda Cedo Demais
    if (state.confidenceLevel === 'insufficient' || !hasDominantHypothesis) {
      return {
        level: 0,
        type: 'too_early',
        payload: {
          surfaceContext: state.contextSignals.length ? state.contextSignals[0] : 'Sinais ainda difusos',
          missingPieces: 'Ainda não é claro de onde vem o maior peso.',
        }
      };
    }

    // NÍVEL 1 — Foco Provisório
    if (state.confidenceLevel === 'moderate' || (!hasFear && !hasMechanism)) {
      return {
        level: 1,
        type: 'provisional',
        payload: {
          dominantTheme: state.dominantHypothesis,
          touchpoint: hasCosts ? `Pesa no(a) ${state.costSignals[0]}` : 'O peso real na rotina ainda não é evidente',
          missingPiece: !hasFear ? 'que cenário estás a tentar evitar' : 'o que fazes para manter isto a funcionar'
        }
      };
    }

    // NÍVEL 3 — Síntese Final Forte (Requisitos Máximos de Densidade)
    if (state.confidenceLevel === 'strong' && hasCosts && hasFear && hasMechanism && hasDesire) {
      return {
        level: 3,
        type: 'final',
        payload: {
          surfaceProblem: state.dominantHypothesis,
          latentPattern: state.mechanismSignals[0],
          coreCost: state.costSignals[0],
          tensionSentence: `A fricção principal parece não estar só no tema manifesto, mas na tensão silenciosa entre o medo de ${state.fearSignals[0]} e a vontade de recuperar ${state.desiredLifeSignals[0]}.`,
          nextActionableStep: state.actionableLevers[0] || 'O primeiro passo é reconhecer o custo sem te censurares.'
        }
      };
    }

    // NÍVEL 2 — Leitura Consolidada (Quando há robustez, mas falta uma dimensão para a Síntese Final)
    return {
      level: 2,
      type: 'consolidated',
      payload: {
        surface: state.dominantHypothesis,
        pattern: hasMechanism ? state.mechanismSignals[0] : 'Defesa primária não identificada',
        cost: hasCosts ? state.costSignals[0] : 'Custo indireto',
        probableCore: state.fearSignals.length ? state.fearSignals[0] : (state.secondaryHypothesis || 'Núcleo em aberto'),
        unsolved: 'A inércia ainda impede a libertação da margem.'
      }
    };
  }
}
