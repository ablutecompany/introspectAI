import type { FrictionArea, InternalState } from '../../../types/internalState';

const AREA_LABELS: Record<FrictionArea, string> = {
  A: 'corpo e sintomatologia', B: 'exaustão real e energia', C: 'ativação mental e ansiedade',
  D: 'sobrecarga e desorganização', E: 'corte relacional', F: 'questões de sentido e eixo', G: 'stresse difuso'
};

export function getRefineUnderstandingOutput(state: InternalState) {
  const area1 = state.triageState?.primary_problem_area ?? 'C';
  const area2 = state.triageState?.secondary_problem_area ?? 'B';
  const label1 = AREA_LABELS[area1 as FrictionArea];
  const label2 = AREA_LABELS[area2 as FrictionArea];

  return {
    title: 'Precisamos de afinar',
    mainText: `Vejo aqui um nó apertado. A triagem levanta duas hipóteses fortes simultâneas: pode ser uma quebra por ${label1}, ou pode estar a nascer de uma pura colisão em ${label2}. Mas a forma como vamos atacar cada um é oposta.`,
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
