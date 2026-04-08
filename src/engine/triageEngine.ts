import type {
  FrictionArea,
  ImmediateGoal,
  TriageState,
  DetailLevel,
} from '../types/internalState';
import type { CaseStructure } from '../types/internalState';

// ─── Area Labels ──────────────────────────────────────────────────────────────
export const AREA_LABELS: Record<Exclude<FrictionArea, 'G'>, string> = {
  A: 'corpo e sintomas',
  B: 'energia e fadiga',
  C: 'mente, ansiedade e tensão',
  D: 'sobrecarga e falta de controlo',
  E: 'relações',
  F: 'sentido e direção',
};

// ─── Q1 — Universal Friction Question ────────────────────────────────────────
export const Q1 = {
  id: 'q1_friction_area',
  text: 'Neste momento, onde sentes a maior fonte de fricção na tua vida?',
  options: [
    { id: 'A', label: 'Corpo / sintomas / desconforto' },
    { id: 'B', label: 'Energia / fadiga / exaustão' },
    { id: 'C', label: 'Mente / ansiedade / tensão / confusão' },
    { id: 'D', label: 'Sobrecarga / caos / falta de controlo' },
    { id: 'E', label: 'Relações / solidão / conflito' },
    { id: 'F', label: 'Sentido / direção / vazio' },
    { id: 'G', label: 'Misto / não sei bem' },
  ] as const,
};

// ─── Q2 Subtype Questions per area ───────────────────────────────────────────

export type SubtypeOption = { id: string; label: string; isDiffuse?: boolean };

export const SUBTYPE_QUESTIONS: Record<
  Exclude<FrictionArea, 'G'>,
  { text: string; options: SubtypeOption[] }
> = {
  A: {
    text: 'O que pesa mais neste momento?',
    options: [
      { id: 'A1', label: 'dor / desconforto físico' },
      { id: 'A2', label: 'sintomas que me preocupam' },
      { id: 'A3', label: 'mal-estar difuso / corpo em baixo' },
      { id: 'A4', label: 'mudanças no corpo que me incomodam' },
      { id: 'A5', label: 'prefiro não especificar / é mais difuso', isDiffuse: true },
    ],
  },
  B: {
    text: 'O que descreve melhor esta dificuldade?',
    options: [
      { id: 'B1', label: 'cansaço constante' },
      { id: 'B2', label: 'acordo sem recuperar' },
      { id: 'B3', label: 'quebro a meio do dia' },
      { id: 'B4', label: 'sinto-me esgotado / em burnout' },
      { id: 'B5', label: 'prefiro não especificar / é mais difuso', isDiffuse: true },
    ],
  },
  C: {
    text: 'O que pesa mais?',
    options: [
      { id: 'C1', label: 'ansiedade / tensão' },
      { id: 'C2', label: 'pensamentos em excesso' },
      { id: 'C3', label: 'confusão / dificuldade em pensar claro' },
      { id: 'C4', label: 'bloqueio / paralisia' },
      { id: 'C5', label: 'prefiro não especificar / é mais difuso', isDiffuse: true },
    ],
  },
  D: {
    text: 'Onde sentes mais falta de controlo?',
    options: [
      { id: 'D1', label: 'demasiadas tarefas / pressão' },
      { id: 'D2', label: 'desorganização / caos' },
      { id: 'D3', label: 'não consigo acompanhar tudo' },
      { id: 'D4', label: 'adio e acumulo' },
      { id: 'D5', label: 'prefiro não especificar / é mais difuso', isDiffuse: true },
    ],
  },
  E: {
    text: 'O que pesa mais nesta área?',
    options: [
      { id: 'E1', label: 'conflito / tensão com alguém importante' },
      { id: 'E2', label: 'distância / frieza / solidão' },
      { id: 'E3', label: 'sentir-me incompreendido' },
      { id: 'E4', label: 'dificuldade em comunicar' },
      { id: 'E5', label: 'prefiro não especificar / é mais difuso', isDiffuse: true },
    ],
  },
  F: {
    text: 'O que descreve melhor isto?',
    options: [
      { id: 'F1', label: 'falta de direção' },
      { id: 'F2', label: 'vazio / falta de significado' },
      { id: 'F3', label: 'dúvida sobre escolhas de vida' },
      { id: 'F4', label: 'sensação de estar perdido' },
      { id: 'F5', label: 'prefiro não especificar / é mais difuso', isDiffuse: true },
    ],
  },
};

// ─── Q2 Mixed — Two dominant areas ───────────────────────────────────────────
export const Q2_MIXED = {
  id: 'q2_mixed_two_areas',
  text: 'Mesmo que esteja tudo misturado, quais são as duas áreas que mais pesam agora?',
  hint: 'Escolhe exatamente duas.',
  options: [
    { id: 'A', label: 'Corpo' },
    { id: 'B', label: 'Energia' },
    { id: 'C', label: 'Mente' },
    { id: 'D', label: 'Sobrecarga / controlo' },
    { id: 'E', label: 'Relações' },
    { id: 'F', label: 'Sentido / direção' },
  ] as const,
};

// ─── Q3 Mixed — Choose dominant ───────────────────────────────────────────────
export const buildQ3Mixed = (
  first: Exclude<FrictionArea, 'G'>,
  second: Exclude<FrictionArea, 'G'>
) => ({
  id: 'q3_mixed_dominant',
  text: 'Se uma destas duas áreas melhorasse já nos próximos 7 dias, qual teria mais impacto real na tua vida?',
  options: [
    { id: first, label: Q1.options.find((o) => o.id === first)?.label ?? first },
    { id: second, label: Q1.options.find((o) => o.id === second)?.label ?? second },
  ],
});

// ─── Q3 Normal — Functional Impact ───────────────────────────────────────────
export const Q3_NORMAL = {
  id: 'q3_functional_impact',
  text: 'Onde é que isto está a mexer mais contigo no dia-a-dia?',
  options: [
    { id: 'A', label: 'no corpo / descanso / energia' },
    { id: 'B', label: 'no trabalho / foco / produtividade' },
    { id: 'C', label: 'nas relações' },
    { id: 'D', label: 'no humor / estabilidade emocional' },
    { id: 'E', label: 'em várias áreas ao mesmo tempo' },
    { id: 'F', label: 'ainda não sei bem' },
  ] as const,
};

// ─── Q4/Q5 — Immediate Goal ───────────────────────────────────────────────────
export const Q_IMMEDIATE_GOAL = {
  id: 'q_immediate_goal',
  text: 'O que mais precisas que mude primeiro?',
  options: [
    { id: 'A', label: 'baixar a tensão / aliviar' },
    { id: 'B', label: 'perceber melhor o que se passa' },
    { id: 'C', label: 'recuperar energia / estabilidade' },
    { id: 'D', label: 'comunicar melhor / ajustar relações' },
    { id: 'E', label: 'ganhar controlo / clareza para agir' },
    { id: 'F', label: 'ainda não sei' },
  ] as const,
};

// ─── Immediate Goal labels ────────────────────────────────────────────────────
export const GOAL_LABELS: Record<ImmediateGoal, string> = {
  A: 'baixar a tensão e aliviar',
  B: 'perceber melhor o que se passa',
  C: 'recuperar energia e estabilidade',
  D: 'comunicar melhor e ajustar relações',
  E: 'ganhar controlo e clareza para agir',
  F: 'ainda não sabe bem',
};

// ─── Diffuse subtype codes ─────────────────────────────────────────────────────
const DIFFUSE_CODES = new Set(['A5', 'B5', 'C5', 'D5', 'E5', 'F5']);

export const isDiffuseSubtype = (subtype: string | null): boolean =>
  subtype !== null && DIFFUSE_CODES.has(subtype);

// ─── Summary Builder ──────────────────────────────────────────────────────────

export function buildTriageSummary(triage: TriageState): string {
  const areaLabel = AREA_LABELS[triage.primary_problem_area];

  // Get the subtype label
  let subtypeLabel: string | null = null;
  if (triage.primary_problem_subtype && !isDiffuseSubtype(triage.primary_problem_subtype)) {
    const area = triage.primary_problem_area;
    const found = SUBTYPE_QUESTIONS[area]?.options.find(
      (o) => o.id === triage.primary_problem_subtype
    );
    if (found) subtypeLabel = found.label;
  }

  const goalLabel = GOAL_LABELS[triage.immediate_goal];

  let summary = `Percebo. O foco principal parece estar em ${areaLabel}`;
  if (subtypeLabel) {
    summary += `, sobretudo em ${subtypeLabel}`;
  }
  summary += '.';

  if (triage.secondary_problem_area) {
    const secondaryLabel = AREA_LABELS[triage.secondary_problem_area];
    summary += `\n\nHá também um segundo eixo a pesar: ${secondaryLabel}.`;
  }

  summary += `\n\nO que mais precisas agora é ${goalLabel}.`;

  return summary;
}

// ─── Map Triage → CaseStructure ───────────────────────────────────────────────

export function mapTriageToCaseStructure(triage: TriageState): Partial<CaseStructure> {
  const areaLabel = AREA_LABELS[triage.primary_problem_area];

  let subtypeLabel: string | null = null;
  if (triage.primary_problem_subtype && !isDiffuseSubtype(triage.primary_problem_subtype)) {
    const found = SUBTYPE_QUESTIONS[triage.primary_problem_area]?.options.find(
      (o) => o.id === triage.primary_problem_subtype
    );
    if (found) subtypeLabel = found.label;
  }

  return {
    caseField: areaLabel,
    surfaceTheme: subtypeLabel,
    openAmbiguities: triage.secondary_problem_area
      ? [`Segundo eixo identificado: ${AREA_LABELS[triage.secondary_problem_area]}`]
      : [],
  };
}

// ─── Detail Level Detector ───────────────────────────────────────────────────
export function resolveDetailLevel(subtype: string | null): DetailLevel {
  return isDiffuseSubtype(subtype) || subtype === null ? 'reserved_diffuse' : 'specific';
}
