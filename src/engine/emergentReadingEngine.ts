/**
 * emergentReadingEngine.ts
 *
 * Sprint 4: Motor de Leitura Emergente Específica.
 *
 * Só gera leitura quando há maturidade mínima suficiente no caso.
 * Usa os dados reais do CaseMemory (foco, hipótese, discriminação,
 * hiddenFunctionCandidate) para produzir leitura mais específica
 * do que a hipótese provisória, sem vender "verdade final".
 *
 * Separado do latentGuidanceEngine para manter responsabilidades claras:
 * - latentGuidanceEngine → hipótese provisória (pré-discriminação)
 * - emergentReadingEngine → leitura emergente (pós-discriminação suficiente)
 */

import type { InternalState, CaseMemory, DiscriminationEntry, FrictionArea } from '../../types/internalState';
import { MAPA_LATENTE } from './latentGuidanceTemplates';

// ─── Gate de Maturidade ────────────────────────────────────────────────────────

/**
 * Determina se o caso tem maturidade suficiente para leitura emergente.
 * Regra honesta e conservadora — não forçar profundidade prematura.
 *
 * Aprova se:
 * - confidenceState === 'strong'              (discriminação confirmou claramente)
 * - OR moderate + sem rival ativo + hotLeads  (foco sólido sem ambiguidade aberta)
 */
export function hasSufficientMaturityForEmergentReading(memory: CaseMemory): boolean {
  if (memory.confidenceState === 'strong') return true;

  if (memory.confidenceState === 'moderate') {
    const hasNoActiveRival = !memory.competingHypothesis
      || isRivalResolved(memory.discriminationRecord ?? []);
    const hasHotLeads = memory.hotLeads.length > 0;
    return hasNoActiveRival && hasHotLeads;
  }

  return false;
}

/**
 * Considera o rival "resolvido" se houve discriminação primary_vs_competing
 * com confirmedPrimary explícito (true ou false, mas não null/ambíguo).
 */
function isRivalResolved(record: DiscriminationEntry[]): boolean {
  return record.some(
    (e) => e.intentTag === 'primary_vs_competing' && e.confirmedPrimary !== null
  );
}

// ─── Estrutura interna da leitura ─────────────────────────────────────────────

/**
 * Os 4 componentes semânticos internos da leitura emergente.
 * Nunca expostos como labels ao utilizador, mas guiam a construção do texto.
 */
interface EmergentReadingComponents {
  /** O que parece estar a acontecer */
  framing: string;
  /** O que isso parece estar a cumprir / função latente */
  function: string;
  /** Porque é que isso prende / a tensão real */
  tension: string;
  /** O preço ou risco invisível */
  cost: string;
}

// ─── Construtor de Componentes ─────────────────────────────────────────────────

/**
 * Constrói os 4 componentes semânticos a partir do estado real do caso.
 * Ancora obrigatoriamente em:
 * - área primária (e eventual confirmação pós-discriminação)
 * - hiddenFunctionCandidate (se existir)
 * - hotLeads (para especificidade)
 * - emergentCandidate do histório de discriminação
 */
function buildComponents(state: InternalState): EmergentReadingComponents {
  const triage = state.triageState;
  const memory = state.caseMemory;
  const area = (triage?.primary_problem_area ?? 'C') as Exclude<FrictionArea, 'G'>;
  const latentData = MAPA_LATENTE[area];

  // Extracção de candidatos do histório de discriminação
  const confirmedEntries = (memory.discriminationRecord ?? []).filter(
    (e) => e.confirmedPrimary === true && e.emergentCandidate
  );
  const dominantFunction = confirmedEntries[0]?.emergentCandidate
    || memory.hiddenFunctionCandidate
    || null;

  // Primeiro hot lead disponível (mais específico do que a área genérica)
  const leadAnchor = memory.hotLeads[0] ?? null;

  // ─── Componente 1: Framing ─────────────────────────────────────────────────
  let framing: string;
  const focusRef = memory.currentFocus ?? dominantFunction ?? latentData.base;
  
  if (memory.lastCorrectionSignal) {
    // Integração de sinal de correção passado
    framing = `Uma coisa ficou clara na nossa exploração: a explicação mais óbvia não servia. O foco ajustou-se para ${focusRef}, e é aí que a pressão parece estar a acumular.`;
  } else if (dominantFunction) {
    framing = `Algo que se impõe aqui: a pressão central não está no problema em si, mas em ${dominantFunction}.`;
  } else {
    framing = `O padrão que começa a emergir aponta para ${latentData.base}.`;
  }

  // Sprint 10D: Usar fragmento orgânico do utilizador ou lead
  const userFragment = memory.userPhrasingFragments?.[memory.userPhrasingFragments.length - 1];
  if (userFragment) {
    framing += ` Como referiste, tem muito a ver com "${userFragment}".`;
  } else if (leadAnchor) {
    framing += ` O sinal mais claro: ${leadAnchor.toLowerCase().replace(/^sintoma raiz apontado: /, '').replace(/^objetivo imediato: /, '')}.`;
  }

  // ─── Componente 2: Função ──────────────────────────────────────────────────
  const salientTerm = memory.salientTerms?.[memory.salientTerms.length - 1];
  let functionText: string;
  
  if (dominantFunction) {
    functionText = `Isto serve algo — mesmo que não intencionalmente. O ciclo atual parece estar a dar ${dominantFunction}, pelo menos de forma transitória.`;
  } else if (salientTerm) {
    functionText = `A tensão que se instalou parece cumprir uma função: a sensação de ${salientTerm} prende a atenção e adia ter de lidar com ${latentData.tension[1]}.`;
  } else {
    functionText = `A tensão que se instalou parece cumprir uma função: manter a atenção fixada em ${latentData.tension[0]}, o que adia ter de lidar com ${latentData.tension[1]}.`;
  }

  // ─── Componente 3: Tensão ──────────────────────────────────────────────────
  let tension = `O paradoxo real: ${latentData.tension[0]} e ${latentData.tension[1]} puxam em sentidos opostos. Não se pode satisfazer os dois ao mesmo tempo, e essa impossibilidade é onde a maior parte da energia se perde.`;
  
  // Sprint 10D: Ancorar tensão na hipótese se for diferente do foco e função
  if (memory.provisionalHypothesis && memory.provisionalHypothesis !== focusRef && memory.provisionalHypothesis !== dominantFunction) {
    tension = `O paradoxo real: sente-se ${memory.provisionalHypothesis}, mas por baixo ${latentData.tension[1]} continua a puxar no sentido oposto. Não se resolve os dois ao mesmo tempo, e é aí que a energia se perde.`;
  }

  // ─── Componente 4: Custo ──────────────────────────────────────────────────
  const cost = `O preço que isto tem é que ${latentData.cost}. Não é inevitável, mas enquanto não for nomeado, mantém-se ativo por baixo.`;

  return { framing, function: functionText, tension, cost };
}

// ─── Guard anti-platitude ──────────────────────────────────────────────────────

/**
 * Verifica se os componentes gerados parecem demasiado genéricos.
 * Critério: se não há nenhum elemento ancorado no caso (function, lead ou
 * candidato de discriminação), o texto é considerado insuficientemente específico.
 */
function isSpecificEnough(memory: CaseMemory): boolean {
  const hasAnchoredFunction = !!memory.hiddenFunctionCandidate
    || (memory.discriminationRecord ?? []).some((e) => !!e.emergentCandidate);
  const hasHotLeads = memory.hotLeads.length > 0;
  
  // Sprint 10D: Também conta como ancorado/específico se houver idioleto ou fragmento extraído do utilizador
  const hasUserPhrasing = (memory.userPhrasingFragments?.length ?? 0) > 0 || (memory.salientTerms?.length ?? 0) > 0;

  // Pelo menos um elemento de especificidade tem de estar presente
  return hasAnchoredFunction || hasHotLeads || hasUserPhrasing;
}

// ─── Output público ────────────────────────────────────────────────────────────

export interface EmergentReadingOutput {
  /** Título a apresentar ao utilizador */
  title: string;
  /** Parágrafo principal da leitura emergente */
  readingParagraph: string;
  /** Guidance curta e não genérica (para Sprint 5 expandir) */
  lightGuidance: string;
  /** Internal flag: indica se a leitura foi gerada com ancoragem real */
  isAnchoredToCase: boolean;
}

/**
 * Ponto de entrada principal: gera a leitura emergente específica
 * ou devolve `null` se o caso ainda não tem maturidade suficiente.
 */
export function buildEmergentReading(state: InternalState): EmergentReadingOutput | null {
  const memory = state.caseMemory;

  // Gate de maturidade — não gerar se insuficiente
  if (!hasSufficientMaturityForEmergentReading(memory)) {
    return null;
  }

  const components = buildComponents(state);
  const isAnchored = isSpecificEnough(memory);

  // Montagem do parágrafo contínuo — sem labels técnicos expostos ao utilizador
  const readingParagraph = [
    components.framing,
    components.function,
    components.tension,
    components.cost,
  ].join(' ');

  // Guidance leve — curta, não genérica, não resolve tudo
  // Sprint 5 pode tornar isto muito mais específico
  const triage = state.triageState;
  const area = (triage?.primary_problem_area ?? 'C') as Exclude<FrictionArea, 'G'>;
  const latentData = MAPA_LATENTE[area];

  const lightGuidance = `Por enquanto, a coisa mais útil é não tratar isto como problema a resolver, mas como padrão a observar. ${latentData.tension[0]} vai continuar a pressionar — não podes parar isso hoje. Podes começar a rasgar a confusão de outra forma.`;

  return {
    title: 'Leitura Emergente',
    readingParagraph,
    lightGuidance,
    isAnchoredToCase: isAnchored,
  };
}

/**
 * Calcula o sessionStage correcto com base na maturidade actual do caso.
 * Usado pelo App.tsx e pelo store para transitar de forma consistente.
 */
export function inferReadingStageFromMemory(memory: CaseMemory): 'PROVISIONAL_FOCUS' | 'DISCRIMINATIVE_EXPLORATION' | 'EMERGENT_READING' {
  if (hasSufficientMaturityForEmergentReading(memory)) return 'EMERGENT_READING';
  const hasDiscrimination = (memory.discriminationRecord ?? []).length > 0;
  return hasDiscrimination ? 'DISCRIMINATIVE_EXPLORATION' : 'PROVISIONAL_FOCUS';
}
