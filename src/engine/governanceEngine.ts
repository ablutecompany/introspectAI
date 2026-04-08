import type { InternalState, IntensityLevel } from '../types/internalState';

export interface GovernanceDecision {
  action: 'continue' | 'ask_extension' | 'close_now';
  reason: string;
  maxAdditionalQuestions?: number;
  missingElement?: string;
}

const META_TRIGGERS = [
  'já respondi', 'estas em loop', 'estás em loop', 'repetir', 'já disse', 'ja disse', 
  'já chega', 'ja chega', 'não tenho mais para acrescentar', 'nao tenho mais para acrescentar',
  'não me repitas', 'nao me repitas', 'estás a torcer', 'estas a torcer', 'não mais do que isto'
];

/** 1. DETEÇÃO DE META-CONVERSA */
export function detectMetaConversation(input: string): boolean {
  const normalized = input.toLowerCase();
  // Exact or partial match on triggers
  if (META_TRIGGERS.some(trigger => normalized.includes(trigger))) return true;

  // Extremely short rejection strings
  if (normalized === 'não' || normalized === 'não sei' || normalized === 'passo') {
    // Basic rejection, slightly different from meta, but signals resistance.
    // We treat it as low tolerance if repeated, but we can return true here if it's very dry.
    // For now, let's keep meta-conversation strict to explicit method rejections.
  }

  return false;
}

/** 2. CONVERSATION LOAD */
export function calculateConversationLoad(state: InternalState): IntensityLevel {
  const turn = state.sessionMeta.questionCount;
  const isFirst = state.governance.budgetProfile === 'first_session_short';
  
  if (isFirst) {
    if (turn < 4) return 'low';
    if (turn >= 4 && turn <= 5) return 'medium';
    return 'high'; // 6+
  } else {
    // Recurring sessions have more elasticity
    if (turn < 8) return 'low';
    if (turn >= 8 && turn <= 12) return 'medium';
    return 'high'; // 13+
  }
}

/** 3. USER TOLERANCE LEVEL */
export function calculateUserTolerance(state: InternalState, currentInput: string): IntensityLevel {
  const len = currentInput.trim().length;
  const turn = state.sessionMeta.questionCount;
  
  let baseTolerance = state.governance.userToleranceLevel;
  
  // If user gives a very dry/short answer after a long interview => drops tolerance
  if (len < 15 && turn > 4) {
    return 'low';
  }

  // If user gave a huge answer => high tolerance
  if (len > 300) {
    return 'high';
  }

  // Triage state detail level fallback
  if (turn <= 2 && state.triageState?.detail_level === 'reserved_diffuse') {
    return 'low';
  }

  return baseTolerance === 'low' ? 'low' : 'medium';
}

/** 4. CLARIFICATION NEED */
export function calculateClarificationNeed(state: InternalState): { level: IntensityLevel, missingElement: string | null } {
  const { caseStructure } = state;
  const targetFields = [
    caseStructure.surfaceNature,
    caseStructure.primaryFunction,
    caseStructure.mainCost
  ];
  
  const filledCount = targetFields.filter(f => f !== null && f.length > 0).length;
  const isFieldFilled = Boolean(caseStructure.caseField);
  
  if (!isFieldFilled) return { level: 'high', missingElement: 'a área base do problema' };
  
  if (filledCount === 3) return { level: 'low', missingElement: null }; // We have enough
  if (filledCount === 2) return { level: 'medium', missingElement: 'um detalhe de mecanismo' };
  return { level: 'high', missingElement: 'o contorno principal do que sentes' };
}

/** 5. AVALIADOR DE GOVERNANCE (DECIDER) */
export function evaluateGovernanceNextStep(state: InternalState, input: string): GovernanceDecision {
  const isMeta = detectMetaConversation(input) || state.governance.metaConversationDetected;
  const load = calculateConversationLoad(state);
  const tolerance = calculateUserTolerance(state, input);
  const { level: need, missingElement } = calculateClarificationNeed(state);
  const extCount = state.governance.extensionCount;

  // Rule 1: Meta-conversation -> Stop immediately
  if (isMeta) {
    return { action: 'close_now', reason: 'meta_conversation' };
  }

  // Rule 2: Low Clarification Need -> Close, we have enough!
  if (need === 'low') {
    return { action: 'close_now', reason: 'sufficient_material' };
  }

  // Rule 3: Load High & Tolerance Low -> Stop immediately (Pushing further will cause churn)
  if (load === 'high' && tolerance === 'low') {
    return { action: 'close_now', reason: 'fatigue_and_load' };
  }

  // Rule 4: Borderline / Over budget but still missing things and user is tolerating -> Ask Extension
  if ((load === 'medium' || load === 'high') && (need === 'medium' || need === 'high') && tolerance !== 'low') {
    if (extCount < 2 && state.governance.permissionToExtend !== 'no') {
       return { 
         action: 'ask_extension', 
         reason: 'need_distinction_over_budget', 
         maxAdditionalQuestions: need === 'high' ? 2 : 1,
         missingElement: missingElement ?? 'um ponto'
       };
    }
  }

  // Rule 5: Value delivered and missing only marginal details -> Close
  if (state.governance.valueDeliveredYet && need === 'medium') {
     return { action: 'close_now', reason: 'value_already_delivered_marginal_need' };
  }

  // Rule 6: Default (under budget, need clarification) -> Continue
  return { action: 'continue', reason: 'nominal_flow' };
}
