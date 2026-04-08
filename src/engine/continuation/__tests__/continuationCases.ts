import { decideContinuationMode } from '../continuationEngine';
import type { InternalState, FrictionArea } from '../../../types/internalState';

function buildMockState(
  primary: FrictionArea,
  secondary: FrictionArea | null,
  goal: string,
  detail: 'specific' | 'reserved_diffuse',
  isEarlyClose: boolean,
  tolerance: 'high' | 'medium' | 'low' = 'medium',
  path: 'normal' | 'mixed' = secondary ? 'mixed' : 'normal'
): Partial<InternalState> {
  return {
    triageState: {
      path,
      primary_problem_area: primary,
      secondary_problem_area: secondary,
      functional_impact_area: 'A',
      immediate_goal: goal as any,
      detail_level: detail
    },
    governance: {
      shouldCloseNow: isEarlyClose,
      userToleranceLevel: tolerance,
      extensionCount: 0,
      fatigueSignals: [],
      // etc
      conversationLoad: 'low',
      clarificationNeed: 'medium',
      permissionToExtend: 'not_asked',
      sessionNovelty: 'first',
      metaConversationDetected: false,
      valueDeliveredYet: true,
      extensionOffered: false,
      extensionAccepted: false,
      shouldStopInterviewing: false,
      shouldAskExtension: false,
      budgetProfile: 'first_session_short',
      lastGovernanceReason: null
    }
  };
}

export function runContinuationEvaluator() {
  const cases = [
    {
      name: '1. Relações + Conflito + Secundário Sentido',
      state: buildMockState('E', 'F', 'B', 'specific', false)
    },
    {
      name: '2. Mente + Ansiedade + Sobrecarga',
      state: buildMockState('C', 'D', 'C', 'specific', false)
    },
    {
      name: '3. Energia + Exaustão + Reserved_Diffuse',
      state: buildMockState('B', null, 'D', 'reserved_diffuse', false)
    },
    {
      name: '4. Sentido + Vazio + POUCA Tolerância',
      state: buildMockState('F', null, 'F', 'specific', false, 'low')
    },
    {
      name: '5. Corpo + Sintoma + Vigilância (Diffuse)',
      state: buildMockState('A', null, 'C', 'reserved_diffuse', false)
    },
    {
      name: '6. Sobrecarga + Caos + Controlo (Specific)',
      state: buildMockState('D', null, 'D', 'specific', false)
    },
    {
      name: '7. Hipótese Inicial Errada (Simulada por Early Close c/ Respingos)',
      state: buildMockState('A', null, 'A', 'specific', true) // Early close forces close_now
    },
    {
      name: '8. Caso em que continuar já não acrescenta nada (Fatigue)',
      state: { ...buildMockState('B', null, 'B', 'specific', false), governance: { ...buildMockState('B', null, 'B', 'specific', false).governance!, fatigueSignals: ['fatigue', 'fatigue'] } }
    },
    {
      name: '9. Refine muda o passo (Misto Cor / Ene)',
      state: buildMockState('C', 'B', 'A', 'specific', false)
    },
    {
      name: '10. App repetitiva vira Close Now',
      state: { ...buildMockState('E', null, 'E', 'specific', false), governance: { ...buildMockState('E', null, 'E', 'specific', false).governance!, extensionCount: 1 } }
    }
  ];

  console.log('--- CONTINUATION MODE EVALUATOR ---');
  let errors = 0;
  
  cases.forEach(c => {
    const output = decideContinuationMode(c.state as InternalState);
    console.log(`\nCaso: ${c.name}`);
    console.log(`-> Modo: ${output.mode}`);
    console.log(`-> Razão: ${output.reason}`);
    
    // Test logic mapping roughly to user requirements
    if (c.name.includes('1. Relações + Conflito') && output.mode !== 'refine_understanding') errors++; // Has competing hypotheses
    if (c.name.includes('3. Energia + Exaustão') && output.mode !== 'test_hypothesis') errors++; // It is diffuse, so test_hypothesis
    if (c.name.includes('4. Sentido') && output.mode !== 'close_now') errors++; // Low tolerance
    if (c.name.includes('6. Sobrecarga') && output.mode !== 'work_from_reading') errors++; // Specific, no secondary
    if (c.name.includes('8. Caso em que') && output.mode !== 'close_now') errors++; // 2 fatigue signals
    if (c.name.includes('10. App repetitiva') && output.mode !== 'close_now') errors++; // extensionCount > 0
  });

  console.log(`\nTOTAL ERRORS: ${errors}`);
  if (errors > 0) process.exit(1);
}

// Inicia se corrido como standalone
runContinuationEvaluator();
