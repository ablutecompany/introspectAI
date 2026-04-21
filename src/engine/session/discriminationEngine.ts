import type {
  InternalState,
  CaseMemory,
  DiscriminationEntry,
  FrictionArea
} from '../../types/internalState';

// ─── Mapa de Funções Ocultas por Área ─────────────────────────────────────────
// Para cada área de fricção primária, define os pares de "função latente" mais
// prováveis que o utilizador pode estar a tentar satisfazer.
// Sprint 4+ irá tornar isto mais rico; por agora é suficiente para discriminar.

const AREA_FUNCTION_PAIRS: Partial<Record<Exclude<FrictionArea, 'G'>, [string, string]>> = {
  A: ['alívio imediato de desconforto', 'controlo e compreensão do que acontece no corpo'],
  B: ['recuperar energia e estabilidade', 'parar de forçar e deixar o sistema descansar'],
  C: ['baixar a ativação e sentir menos tensão', 'perceber a origem do ciclo de pensamento'],
  D: ['ganhar controlo e reduzir caos prático', 'perceber o que está a gerar a sobrecarga realmente'],
  E: ['resolver ou sair do conflito', 'ser visto e compreendido por quem importa'],
  F: ['encontrar um caminho claro', 'perceber o que está a impedir de avançar'],
};

const AREA_LABELS: Record<Exclude<FrictionArea, 'G'>, string> = {
  A: 'corpo e sintomas',
  B: 'energia e fadiga',
  C: 'mente, ansiedade e tensão',
  D: 'sobrecarga e falta de controlo',
  E: 'relações',
  F: 'sentido e direção',
};

// ─── Interface de Output ───────────────────────────────────────────────────────

export interface DiscriminationQuestion {
  /** Tag de intenção — usada para deduplicar posteriormente */
  intentTag: string;
  /** Texto da pergunta a apresentar ao utilizador */
  questionText: string;
  /** Breve contextualização para o utilizador antes da pergunta */
  contextText: string;
}

// ─── Funções principais ────────────────────────────────────────────────────────

/**
 * Verifica se já foi feita uma pergunta com este intentTag.
 * Evita repetição funcional disfarçada de nova pergunta.
 */
export function wasIntentAlreadyAsked(
  discriminationRecord: DiscriminationEntry[],
  intentTag: string
): boolean {
  return discriminationRecord.some((e) => e.intentTag === intentTag);
}

/**
 * Gera a pergunta discriminadora adequada ao estado actual do caso.
 * Devolve `null` se não há pergunta útil a fazer (já discriminado ou sem rival).
 */
export function buildDiscriminationQuestion(
  state: InternalState
): DiscriminationQuestion | null {
  const triage = state.triageState;
  const memory = state.caseMemory;

  if (!triage) return null;

  const area = triage.primary_problem_area;
  const secArea = triage.secondary_problem_area;
  const record = memory.discriminationRecord ?? [];

  // ─── Caso 1: Há área secundária (hipótese rival identificada) ──────────────
  // Pergunta: separar qual das duas áreas é o epicentro real
  const primaryVsCompetingTag = 'primary_vs_competing';
  if (secArea && !wasIntentAlreadyAsked(record, primaryVsCompetingTag)) {
    const labelPrimary = AREA_LABELS[area];
    const labelSecondary = AREA_LABELS[secArea as Exclude<FrictionArea, 'G'>];

    return {
      intentTag: primaryVsCompetingTag,
      contextText: `A triagem aponta simultaneamente para dois eixos: ${labelPrimary} e ${labelSecondary}. A forma de trabalhar cada um é diferente.`,
      questionText: `Se uma destas duas áreas resolvesse amanhã, qual teria mais impacto real no teu dia-a-dia — ${labelPrimary} ou ${labelSecondary}?`,
    };
  }

  // ─── Caso 2: Foco bem definido — separar a função latente ─────────────────
  // Pergunta: o utilizador quer alívio ou compreensão?
  const functionDiscrimTag = `function_${area}`;
  const functionPair = AREA_FUNCTION_PAIRS[area];
  if (functionPair && !wasIntentAlreadyAsked(record, functionDiscrimTag)) {
    const [optionA, optionB] = functionPair;
    const labelArea = AREA_LABELS[area];

    return {
      intentTag: functionDiscrimTag,
      contextText: `Em relação a ${labelArea}, há duas necessidades que costumam parecer iguais mas apontam para soluções opostas.`,
      questionText: `O que precisas mais neste momento: ${optionA} — ou — ${optionB}?`,
    };
  }

  // Não há pergunta discriminadora útil a fazer neste ciclo
  return null;
}

/**
 * Interpreta a resposta do utilizador e actualiza o CaseMemory.
 * Regra simples e honesta:
 * - resposta curta / vazia → não muda confidenceState
 * - resposta aponta para área primária → confirmedPrimary = true
 * - resposta aponta para área secundária / refuta → confirmedPrimary = false
 * - em ambos os casos, tenta extrair hiddenFunctionCandidate
 */
export function interpretDiscriminationAnswer(
  state: InternalState,
  question: DiscriminationQuestion,
  rawAnswer: string
): Partial<CaseMemory> {
  const triage = state.triageState;
  const memory = state.caseMemory;
  const area = triage?.primary_problem_area;
  const secArea = triage?.secondary_problem_area;

  const answer = rawAnswer.trim();
  const record = memory.discriminationRecord ?? [];

  // Sem resposta real → registar mas não alterar confidência
  if (!answer || answer.length < 5) {
    const entry: DiscriminationEntry = {
      intentTag: question.intentTag,
      question: question.questionText,
      answer,
      confirmedPrimary: null,
      emergentCandidate: null,
    };
    return { discriminationRecord: [...record, entry] };
  }

  // Heurística de confirmação/refutação baseada na presença das labels nas respostas
  let confirmedPrimary: boolean | null = null;
  let emergentCandidate: string | null = null;

  if (area) {
    const primaryLabel = AREA_LABELS[area].toLowerCase();
    const answerLower = answer.toLowerCase();

    if (question.intentTag === 'primary_vs_competing' && secArea) {
      const secLabel = AREA_LABELS[secArea as Exclude<FrictionArea, 'G'>].toLowerCase();
      // Se a resposta menciona a área secundária mais do que a primária → refutação
      const mentionsSecondary = answerLower.includes(secLabel.split(' ')[0]);
      const mentionsPrimary = answerLower.includes(primaryLabel.split(' ')[0]);
      confirmedPrimary = mentionsPrimary && !mentionsSecondary ? true
        : mentionsSecondary && !mentionsPrimary ? false
        : null; // ambíguo → não forçar
    } else if (question.intentTag.startsWith('function_')) {
      // Tentativa de extrair função latente das respostas com palavras-chave
      const functionPair = AREA_FUNCTION_PAIRS[area];
      if (functionPair) {
        const [optA, optB] = functionPair;
        const matchA = optA.split(' ').filter((w) => w.length > 4).some((w) => answerLower.includes(w));
        const matchB = optB.split(' ').filter((w) => w.length > 4).some((w) => answerLower.includes(w));
        if (matchA && !matchB) {
          emergentCandidate = optA;
          confirmedPrimary = true;
        } else if (matchB && !matchA) {
          emergentCandidate = optB;
          confirmedPrimary = false;
        }
      }
    }
  }

  // Calcular novo confidenceState
  const currentConfidence = memory.confidenceState;
  let newConfidence = currentConfidence;

  if (confirmedPrimary === true && currentConfidence === 'insufficient') {
    newConfidence = 'moderate';
  } else if (confirmedPrimary === true && currentConfidence === 'moderate') {
    newConfidence = 'strong';
  } else if (confirmedPrimary === false && currentConfidence !== 'insufficient') {
    // Refutação desce a confiança (mantém moderate se for a primeira vez)
    newConfidence = 'moderate';
  }

  const entry: DiscriminationEntry = {
    intentTag: question.intentTag,
    question: question.questionText,
    answer,
    confirmedPrimary,
    emergentCandidate,
  };

  return {
    discriminationRecord: [...record, entry],
    confidenceState: newConfidence,
    // Preencher hiddenFunctionCandidate se emergiu um candidato claro
    ...(emergentCandidate ? { hiddenFunctionCandidate: emergentCandidate } : {}),
  };
}
