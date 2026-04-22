/**
 * continuationTemplates.ts
 *
 * Sprint 2: Templates base de continuação.
 * Sprint 7: Enriquecido com 4 famílias diferenciadas por WorkingDirection:
 *   confirm | correct | deepen | stabilize
 *
 * Regras de redacção:
 * - Sem slogans de coach
 * - Sem platitudes ("é natural sentires isso")
 * - Tom directo, útil, ancorado no caso real
 * - Cada família soa materialmente diferente das outras
 * - O micro_step não pode ser igual em 2 trajectórias distintas
 *
 * Ponto de extensão: Sprint 8 pode tornar os micro_steps
 * mais ricos com dados de userIdiolect e hotLeads.
 */

import type { FrictionArea, InternalState, WorkingDirection } from '../../../types/internalState';
import { buildDiscriminationQuestion } from '../session/discriminationEngine';

// ─── Labels por área de fricção ────────────────────────────────────────────────

const AREA_LABELS: Record<FrictionArea, string> = {
  A: 'corpo e sintomatologia', B: 'exaustão real e energia', C: 'ativação mental e ansiedade',
  D: 'sobrecarga e desorganização', E: 'corte relacional', F: 'questões de sentido e eixo', G: 'stresse difuso'
};

// Labels mais curtas para usar dentro de frases
const AREA_SHORT: Record<FrictionArea, string> = {
  A: 'o corpo', B: 'a energia', C: 'a ativação mental', D: 'a sobrecarga',
  E: 'o vínculo', F: 'o sentido', G: 'o stresse difuso'
};

// ─── Utilitário de hash determinístico (sem randomness) ────────────────────────

function pickByHash(variants: string[], seed: string): string {
  const sum = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return variants[sum % variants.length];
}

// ─── Templates existentes (Sprint 2) ─────────────────────────────────────────

export function getRefineUnderstandingOutput(state: InternalState) {
  const area1 = state.triageState?.primary_problem_area ?? 'C';
  const area2 = state.triageState?.secondary_problem_area ?? 'B';
  const label1 = AREA_LABELS[area1 as FrictionArea];
  const label2 = AREA_LABELS[(area2 ?? 'B') as FrictionArea];

  // Sprint 3: usar o motor de discriminação para gerar a pergunta real
  const discriminationQ = buildDiscriminationQuestion(state);

  if (discriminationQ) {
    return {
      title: 'Afinar o Foco',
      mainText: discriminationQ.contextText,
      optionalPrompt: discriminationQ.questionText,
      // Guardar no output para que App.tsx saiba o intentTag desta pergunta
      // e possa registar a resposta correctamente
      _discriminationIntentTag: discriminationQ.intentTag,
    };
  }

  // Fallback genérico se o motor não devolver pergunta
  return {
    title: 'Afinar o Foco',
    mainText: `Há aqui um nó apertado. A triagem levanta duas hipóteses fortes simultâneas: pode ser uma quebra por ${label1}, ou pode estar a nascer de uma pura colisão em ${label2}. Mas a forma como vamos atacar cada um é oposta.`,
    optionalPrompt: `Se tivesses de apontar onde a dor rasga mais, qual destas áreas é o epicentro do estoiro hoje?`,
  };
}

export function getTestHypothesisOutput(state: InternalState) {
  const area = state.triageState?.primary_problem_area ?? 'C';
  const label = AREA_LABELS[area as FrictionArea];

  return {
    title: 'Testar Leitura',
    mainText: `Há aqui um ponto que me parece central, mas que falaste de forma menos declarada: isto pode estar menos numa saturação geral e mais fechado num problema real de ${label}.`,
    optionalPrompt: `Isto bate certo com a sensação real que tens tido, ou estás a sentir algo que foge deste quadro de ${label}?`,
  };
}

export function getWorkFromReadingOutput(state: InternalState) {
  const area = state.triageState?.primary_problem_area ?? 'C';
  const label = AREA_LABELS[area as FrictionArea];

  return {
    title: 'Orientação de Trabalho',
    mainText: `Por agora, a única coisa a reter: não trates mais isto como se fosse uma neblina aleatória. É uma manifestação pura de ${label}.`,
    closingText: 'O que não podes fazer agora é acelerar a tomada de decisão para tentares forçar que essa tensão desapareça hoje. O passo mais útil agora é mapeares os teus picos de pressão antes da próxima recolha.'
  };
}

export function getCloseNowOutput(state: InternalState, reason: string | null) {
  if (reason === 'meta_conversation') {
    return {
      title: 'Ponto de Partida',
      mainText: 'Sinto que o teu limite de escrutínio chegou ao fim de linha, e a melhor distinção de valor que poderias tirar agiria mais como ruído se continuássemos.',
      closingText: 'Para já, ficamos por aqui sem forçar respostas. Observa como esta tensão colide com o que te faz falta hoje.'
    };
  }

  const area = state.triageState?.primary_problem_area ?? 'C';
  const label = AREA_LABELS[area as FrictionArea];

  return {
    title: 'Encerramento Limpo',
    mainText: `Para já, eu ficava por aqui. O essencial era extraíres esta raiz principal de ${label}. Continuar a teorizar não te daria um micro-passo melhor do que a observação bruta na prática.`,
    closingText: 'Vê o que acontece nestas horas a seguir quando não cedes à necessidade de empurrar a solução à força.'
  };
}

// ─── Sprint 7: Router principal por WorkingDirection ─────────────────────────

/**
 * Selecciona os templates correctos com base no WorkingDirection calculado no Sprint 6.
 * Chamado pelo continuationEngine quando há followUpInference disponível.
 *
 * Nota: a família de output substitui os templates clássicos neste contexto —
 * o engine de continuação usa estes quando é sessão de reentrada.
 * Os templates clássicos mantêm-se para primeiras sessões.
 */
export function getDirectedContinuationOutput(
  state: InternalState,
  direction: WorkingDirection
) {
  switch (direction) {
    case 'confirm': return getConfirmOutput(state);
    case 'correct': return getCorrectOutput(state);
    case 'deepen':  return getDeepenOutput(state);
    case 'stabilize': return getStabilizeOutput(state);
  }
}

// ─── Sprint 7: Família CONFIRM ─────────────────────────────────────────────────
// Quando o padrão se confirma entre sessões.
// Tom: sólido, directo. Não celebra, não repete. Avança.

function getConfirmOutput(state: InternalState) {
  const area = state.triageState?.primary_problem_area ?? 'C';
  const areaShort = AREA_SHORT[area as FrictionArea];
  const memory = state.caseMemory;

  // Usar currentFocus ou provisionalHypothesis se disponível
  const hypothesis = memory.currentFocus ?? memory.provisionalHypothesis ?? null;
  const hasHypothesis = !!hypothesis;

  // Micro-step confirm: observar repetição com mais precisão
  const microSteps = [
    `Nos próximos dias, observa quando é que ${areaShort} aparece com mais força — mas desta vez regista também o que aconteceu logo antes. Não o que sentiste, o que aconteceu.`,
    `Antes da próxima sessão, apanha um momento em que ${areaShort} seja especialmente vivo e escreve três palavras sobre o que estava no ar nessa hora.`,
    `Tenta isolar um episódio concreto desta semana onde este padrão se repita. Não precisas de o analisar — só de o apanhar em flagrante.`,
  ];

  const microStep = pickByHash(microSteps, area + (hypothesis ?? ''));

  if (hasHypothesis) {
    return {
      title: 'Padrão Confirmado',
      mainText: `O que apareceu hoje não é novo — é o mesmo padrão, mais nítido. "${hypothesis}" mantém-se como a leitura mais útil do que está a acontecer em ${areaShort}.`,
      closingText: microStep,
    };
  }

  return {
    title: 'Padrão Confirmado',
    mainText: `O padrão voltou a aparecer. Não é acidente — é o mesmo nó, com a mesma mecânica. Isso já nos diz alguma coisa sobre o que está aqui por baixo.`,
    closingText: microStep,
  };
}

// ─── Sprint 7: Família CORRECT ────────────────────────────────────────────────
// Quando a hipótese anterior estava errada ou incompleta.
// Tom: honesto, sem drama. Recentra sem anular o trabalho anterior.

function getCorrectOutput(state: InternalState) {
  const area = state.triageState?.primary_problem_area ?? 'C';
  const areaShort = AREA_SHORT[area as FrictionArea];
  const memory = state.caseMemory;
  const previousHypothesis = memory.currentFocus ?? memory.provisionalHypothesis ?? null;
  const delta = memory.lastProgressDelta;

  // Linha sobre o que mudou (se soubermos)
  const changeClue = delta?.changeDirection === 'shifted'
    ? 'O padrão mudou de natureza desde a última vez.'
    : delta?.changeDirection === 'worsened'
    ? 'O padrão ficou mais pesado entre sessões.'
    : 'Algo neste padrão não estava a ser bem lido.';

  // Micro-step correct: testar nova leitura, não a anterior
  const microSteps = [
    `Esta semana, quando ${areaShort} aparecer, tenta observá-l${area === 'B' || area === 'D' ? 'a' : 'o'} como se fosse a primeira vez — sem usar a leitura anterior. O que é que realmente vês?`,
    `Antes da próxima sessão, escreve uma frase sobre o que sentes que ainda não foi nomeado. Não o que a app te disse — o que achas que ficou por dizer.`,
    `Nota se o que está a acontecer em ${areaShort} tem uma causa diferente do que tínhamos assumido. Uma semana de observação honesta ajuda mais do que analisar o passado.`,
  ];

  const microStep = pickByHash(microSteps, area + (previousHypothesis ?? ''));

  return {
    title: 'A Reler o Padrão',
    mainText: previousHypothesis
      ? `${changeClue} A leitura de "${previousHypothesis}" pode não ser o quadro completo. Não quer dizer que estava errada — quer dizer que o padrão tem mais textura do que o que vimos da última vez.`
      : `${changeClue} O foco em ${areaShort} mantém-se, mas a mecânica por baixo pode ser diferente do que tínhamos assumido.`,
    optionalPrompt: `Se tivesses de apostar numa causa completamente diferente para isto, qual seria a primeira que te vinha à cabeça agora?`,
    closingText: microStep,
  };
}

// ─── Sprint 7: Família DEEPEN ─────────────────────────────────────────────────
// Quando o foco é válido mas falta função oculta / tensão / custo.
// Tom: cirúrgico, específico. Não repete o que já foi perguntado.

function getDeepenOutput(state: InternalState) {
  const area = state.triageState?.primary_problem_area ?? 'C';
  const areaShort = AREA_SHORT[area as FrictionArea];
  const memory = state.caseMemory;

  // Evitar repetir perguntas já feitas (anti-deduplicação mínima)
  const askedTags = memory.discriminationRecord?.map((d) => d.intentTag) ?? [];
  const hasAskedFunction = askedTags.includes('hidden_function') || askedTags.includes('primary_vs_competing');
  const hasAskedCost = askedTags.includes('relief_vs_control') || askedTags.includes('cost_visibility');

  // Hash base para variar perguntas — muda por área + tags já perguntadas
  const hashBase = area + askedTags.join('');

  // Decidir o ângulo de aprofundamento que ainda não foi explorado
  // Cada ângulo tem 2 variantes para evitar repetição em sessões múltiplas
  let mainText: string;
  let optionalPrompt: string;

  if (!hasAskedFunction) {
    // Aprofundar pela função oculta
    mainText = `O foco em ${areaShort} está a segurar-se, mas ainda não percebemos bem o que é que este padrão está a fazer por ti — o que é que ele permite evitar, adiar ou não ter de enfrentar.`;
    optionalPrompt = pickByHash([
      `Não é para encontrares a resposta hoje. Mas pensa nisto: Se este problema fosse resolvido hoje por magia, que outra decisão aborrecida ou difícil terias de enfrentar logo a seguir?`,
      `Pensa um pouco nisto: Que tarefa, conversa ou decisão é que esta situação te está a dar uma desculpa (mesmo que involuntária) para adiar?`,
    ], hashBase);
  } else if (!hasAskedCost) {
    // Aprofundar pelo custo invisível
    mainText = `A trajectória em ${areaShort} é clara, mas o custo real — o que isto drena de forma silenciosa — ainda não foi nomeado directamente.`;
    optionalPrompt = pickByHash([
      `Deixa só a pergunta no ar durante hoje: O que é que deixaste fisicamente de conseguir fazer nos últimos 3 dias por estares a gastar forças a lidar com isto?`,
      `Apenas repara nisto ao longo da semana: Em que momento exato a energia te faltou para algo que antes era fácil, só porque este tema estava a correr em pano de fundo?`,
    ], hashBase);
  } else {
    // Aprofundar pela tensão não resolvida
    mainText = `Em ${areaShort}, já identificámos função e custo. O que falta é perceber onde é que a tensão entre o que é exigido e o que tens realmente disponível está a apertar mais.`;
    optionalPrompt = pickByHash([
      `Sem tentar analisar demasiado: Qual foi o momento da tua semana em que sentiste de forma mais óbvia que a força que tinhas não ia chegar para o que estava à tua frente?`,
      `Mantém os olhos abertos para isto: Onde é que o sapato aperta mais neste momento — naquilo que és mesmo obrigado a fazer, ou naquilo que tu exiges de ti próprio?`,
    ], hashBase);
  }

  // Micro-step deepen: separar função oculta de tema aparente
  const microSteps = [
    `Esta semana, quando o padrão aparecer, pergunta-te: "O que é que isto me permite não ter de fazer?" Não precisas de responder logo — só de notar se a pergunta encaixa.`,
    `Antes da próxima sessão, sem analisar, escreve uma frase sobre o que seria diferente na tua semana se este tema não existisse. O que mudaria concretamente.`,
    `Tenta observar se quando ${areaShort} está mais activ${area === 'B' || area === 'D' ? 'a' : 'o'}, há algo que ficas dispensado de confrontar. Pode ser subtil.`,
  ];

  const microStep = pickByHash(microSteps, hashBase);

  return {
    title: 'Aprofundar o Padrão',
    mainText,
    optionalPrompt,
    closingText: microStep,
  };
}

// ─── Sprint 7: Família STABILIZE ──────────────────────────────────────────────
// Quando há mais clareza e menos variação — não reabrir tudo.
// Tom: firme, contenido. Nomeia o que está a funcionar. Evita regressão.

function getStabilizeOutput(state: InternalState) {
  const area = state.triageState?.primary_problem_area ?? 'C';
  const areaShort = AREA_SHORT[area as FrictionArea];
  const memory = state.caseMemory;
  const workDone = memory.assignedWork;
  const hypothesis = memory.currentFocus ?? memory.provisionalHypothesis ?? null;

  // Nomear o que está a funcionar (sem exagerar)
  let mainText: string;
  if (hypothesis) {
    mainText = `O padrão em ${areaShort} está mais assente. A leitura de "${hypothesis}" está a segurar-se sem variação excessiva — o que é sinal de que o trabalho está no sítio certo.`;
  } else {
    mainText = `O padrão em ${areaShort} está mais calmo entre sessões. Isso não é irrelevante — é sinal de que algo mudou, mesmo que subtilmente.`;
  }

  // Micro-step stabilize: consolidar o que já mudou, não reabrir
  const microSteps = [
    `Não é altura de rever tudo de novo. A tarefa desta semana é continuares a fazer o que já estás a fazer — com atenção para quando tens vontade de acelerar ou de resolver mais do que é preciso.`,
    `Mantém o ritmo de observação sem acrescentar complexidade. Se sentires que queres reabrir algo que parecia resolvido, nota isso — mas não cedas logo.`,
    `O próximo passo útil é proteger o que já ganhou estabilidade. Evita introduzir novas variáveis enquanto o padrão ainda está a assentar.`,
  ];

  const microStep = pickByHash(microSteps, area + (workDone ?? ''));

  // Se havia work assignment, referir directamente
  const closingText = workDone
    ? `Continuaste com "${workDone}". Mantém esse registo — é exactamente o tipo de observação que vai consolidar o que percebeste.`
    : microStep;

  return {
    title: 'A Assentar',
    mainText,
    closingText,
  };
}
