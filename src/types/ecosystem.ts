export type IntensityIndicator = 'low' | 'medium' | 'high';
export type ConfidenceIndicator = 'inferred' | 'explicit' | 'uncertain';
export type TemporalityIndicator = 'acute' | 'persistent' | 'uncertain';

export interface EcosystemField {
  intensity: IntensityIndicator;
  confidence: ConfidenceIndicator;
  temporality: TemporalityIndicator;
  origin: string;
}

export interface EcosystemProfile {
  wearLevel: EcosystemField | null;
  controlLossSense: EcosystemField | null;
  responsibilityOverload: EcosystemField | null;
  supportFragility: EcosystemField | null;
  ruminationRisk: EcosystemField | null;
  hyperalertnessRisk: EcosystemField | null;
  delayedLifePattern: EcosystemField | null;
  defensiveRigidity: EcosystemField | null;
  actionReadiness: EcosystemField | null;
  protectiveFactors: EcosystemField | null;
}
