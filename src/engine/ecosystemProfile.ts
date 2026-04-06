import type { InternalState } from '../types/internalState';
import type { EcosystemProfile, IntensityIndicator, ConfidenceIndicator } from '../types/ecosystem';

export class EcosystemMapper {
  static generateProfile(state: InternalState): EcosystemProfile {
    const resolveIntensity = (signals: string[]): IntensityIndicator => {
      if (signals.length > 3) return 'high';
      if (signals.length > 0) return 'medium';
      return 'low';
    };

    const resolveConfidence = (): ConfidenceIndicator => {
        if (state.confidenceLevel === 'strong') return 'explicit';
        if (state.confidenceLevel === 'moderate') return 'inferred';
        return 'uncertain';
    };

    const hasCosts = state.costSignals.length > 0;
    
    return {
      wearLevel: hasCosts ? {
        intensity: resolveIntensity(state.costSignals),
        confidence: resolveConfidence(),
        temporality: 'persistent',
        origin: state.costSignals[0]
      } : null,
      controlLossSense: null, 
      responsibilityOverload: null,
      supportFragility: null,
      ruminationRisk: state.fearSignals.some(f => f.includes('falhar') || f.includes('ruminação')) ? {
         intensity: 'medium',
         confidence: resolveConfidence(),
         temporality: 'uncertain',
         origin: 'Medos mapeados inferidos'
      } : null,
      hyperalertnessRisk: null,
      delayedLifePattern: state.desiredLifeSignals.length > 0 ? {
         intensity: 'medium',
         confidence: resolveConfidence(),
         temporality: 'persistent',
         origin: 'Projeção de vida desejada'
      } : null,
      defensiveRigidity: state.mechanismSignals.length > 0 ? {
          intensity: resolveIntensity(state.mechanismSignals),
          confidence: resolveConfidence(),
          temporality: 'persistent',
          origin: state.mechanismSignals[0]
      } : null,
      actionReadiness: {
          intensity: 'medium', 
          confidence: resolveConfidence(),
          temporality: 'acute',
          origin: `Nível de prontidão deduzido do turno ${state.turnIndex}`
      },
      protectiveFactors: null
    };
  }
}
