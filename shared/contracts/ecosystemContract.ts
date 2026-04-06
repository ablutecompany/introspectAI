export type EcosystemIntensity = 'low' | 'medium' | 'high';
export type EcosystemConfidence = 'low' | 'medium' | 'high';
export type EcosystemTemporality = 'acute' | 'persistent' | 'uncertain';

export interface EcosystemSignal {
  intensity: EcosystemIntensity;
  confidence: EcosystemConfidence;
  temporality: EcosystemTemporality;
  origin: string; // "inferido por evasão", "declarado explicitamente"
}

export interface EcosystemProfile {
  wearLevel?: EcosystemSignal;
  controlLossSense?: EcosystemSignal;
  responsibilityOverload?: EcosystemSignal;
  supportFragility?: EcosystemSignal;
  ruminationRisk?: EcosystemSignal;
  hyperalertnessRisk?: EcosystemSignal;
  delayedLifePattern?: EcosystemSignal;
  defensiveRigidity?: EcosystemSignal;
  actionReadiness?: EcosystemSignal;
  protectiveFactors?: EcosystemSignal;
}
