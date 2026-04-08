import { buildLatentAndGuidanceDeterministic } from './latentGuidanceEngine';
import type { InternalState, FrictionArea, ImmediateGoal, DetailLevel } from '../types/internalState';

const AREAS: FrictionArea[] = ['A', 'B', 'C', 'D', 'E', 'F'];
const GOALS: ImmediateGoal[] = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface TestCase {
  id: string;
  name: string;
  state: Partial<InternalState>;
}

export const generateTestCases = (): TestCase[] => {
  const cases: TestCase[] = [];
  let idCounter = 1;

  // 1. Standard one for each area
  for (let i = 0; i < 6; i++) {
    cases.push({
      id: `case_${idCounter++}`,
      name: `Standard - Area ${AREAS[i]} - Goal ${GOALS[i]}`,
      state: createMockState(AREAS[i], null, GOALS[i], 'specific', false)
    });
  }

  // 2. Reserved/Diffuse outputs
  cases.push({ id: `case_${idCounter++}`, name: 'Diffuse - Energia (B)', state: createMockState('B', null, 'C', 'reserved_diffuse', false) });
  cases.push({ id: `case_${idCounter++}`, name: 'Diffuse - Corpo (A)', state: createMockState('A', null, 'D', 'reserved_diffuse', false) });

  // 3. Early Close (Tolerance/Meta)
  cases.push({ id: `case_${idCounter++}`, name: 'Early Close - Relacoes (E)', state: createMockState('E', null, 'F', 'specific', true) });
  cases.push({ id: `case_${idCounter++}`, name: 'Early Close - Mente (C)', state: createMockState('C', null, 'A', 'specific', true) });

  // 4. Mixed (Secondary areas)
  cases.push({ id: `case_${idCounter++}`, name: 'Mixed E(Relações) + F(Sentido)', state: createMockState('E', 'F', 'C', 'specific', false) });
  cases.push({ id: `case_${idCounter++}`, name: 'Mixed C(Mente) + B(Energia)', state: createMockState('C', 'B', 'A', 'specific', false) });

  return cases;
};

// Helper mock builder
function createMockState(area: FrictionArea, secArea: FrictionArea | null, goal: ImmediateGoal, detail: DetailLevel, earlyClose: boolean): Partial<InternalState> {
  return {
    triageState: {
      path: secArea ? 'mixed' : 'normal',
      primary_problem_area: area as Exclude<FrictionArea, 'G'>,
      primary_problem_subtype: `${area}1`,
      secondary_problem_area: secArea as Exclude<FrictionArea, 'G'> | null,
      functional_impact_area: 'A',
      immediate_goal: goal,
      detail_level: detail,
      completedAt: Date.now()
    },
    governance: {
      userToleranceLevel: 'medium',
      conversationLoad: 'low',
      clarificationNeed: 'low',
      permissionToExtend: 'not_asked',
      sessionNovelty: 'first',
      fatigueSignals: [],
      metaConversationDetected: earlyClose,
      valueDeliveredYet: false,
      extensionCount: 0,
      extensionOffered: false,
      extensionAccepted: false,
      shouldStopInterviewing: earlyClose,
      shouldAskExtension: false,
      shouldCloseNow: earlyClose,
      budgetProfile: 'first_session_short',
      lastGovernanceReason: earlyClose ? 'meta_conversation' : null
    }
  };
}

// Scorer function
export function runEvaluator() {
  const testCases = generateTestCases();
  const report: any[] = [];
  
  let scoreTotal = 0;
  let totalWarnings = 0;

  const phraseOpenersCount: Record<string, number> = {};

  for (const tc of testCases) {
    const output = buildLatentAndGuidanceDeterministic(tc.state as InternalState);
    const flags: string[] = [];
    const fullText = output.latentParagraph + " " + output.guidanceParagraph + " " + output.closingLine;

    // A. Output length for voice (TTS comfort check). 
    // Usually a sentence > 180 chars without punctuation is breathless.
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
    let isBreathless = false;
    for (const s of sentences) {
      if (s.trim().length > 175 && !s.includes(',') && !s.includes(';')) {
        isBreathless = true;
      }
    }
    if (isBreathless) flags.push('output_too_long_for_voice');

    // B. Usage of Secondary Area missing
    if (tc.state.triageState?.secondary_problem_area) {
       // Look for keywords
       if (!output.latentParagraph.includes('tocar') && !fullText.includes(tc.state.triageState.secondary_problem_area)) {
           // We might not have the raw keyword if we map labels, but we check for general enrichment
           if (!fullText.includes('Ganha contornos') && !fullText.includes('embora')) flags.push('secondary_area_not_used');
       }
    }

    // C. Detect rigid symmetry (Opener checking)
    const firstFiveWords = output.latentParagraph.split(' ').slice(0, 5).join(' ');
    phraseOpenersCount[firstFiveWords] = (phraseOpenersCount[firstFiveWords] || 0) + 1;

    // D. Early close check
    if (tc.state.governance?.shouldCloseNow) {
       if (fullText.length < 50) flags.push('early_close_too_thin');
    }

    // Goal representation is largely deterministically done via MODULADORES_OBJETIVO now, but we verify its string is inside.
    // E. Goal variation
    if (!tc.state.governance?.shouldCloseNow) {
      if (!output.guidanceParagraph.includes('tratar disto') && !output.guidanceParagraph.includes('focando') && !fullText.includes('pressão') && !fullText.includes('Limpando') && !fullText.includes('velocidade')) flags.push('guidance_goal_not_reflected');
    }

    report.push({
      caseId: tc.id,
      name: tc.name,
      flags,
      outputSnippet: fullText.substring(0, 80) + '...'
    });
    totalWarnings += flags.length;
    scoreTotal += (5 - flags.length);
  }

  // Count opener repetitions
  let maxOpenerRepetitions = 0;
  for (const count of Object.values(phraseOpenersCount)) {
     if (count > maxOpenerRepetitions) maxOpenerRepetitions = count;
  }
  // If we have 12 cases and 12 use the exact same first 5 words, that's rigid symmetry
  if (maxOpenerRepetitions > testCases.length / 2) {
      report.push({ caseId: 'GLOBAL', name: 'Symmetry Analysis', flags: ['repetition_detected_in_openers'], outputSnippet: 'Variation needed' });
      totalWarnings++;
  }

  console.log('--- LATENT GUIDANCE SCORE REPORT ---');
  console.log(`Cases Tested: ${testCases.length}`);
  console.log(`Total Warnings: ${totalWarnings}`);
  console.log(`Openers frequency:`, phraseOpenersCount);
  for (const r of report) {
    if (r.flags.length > 0) {
      console.log(`[WARN] ${r.name}: ${r.flags.join(', ')}`);
    }
  }
}
runEvaluator();  
