/**
 * clarificationEngine.ts
 * 
 * Sprint 8: Repair Loop para incompreensão.
 * 
 * Um motor determinístico e "stateless" que recebe um estado de caso e uma tag 
 * de intenção original e devolve uma formulação simplificada.
 * 
 * Se já foi reformulado antes (verificado via state), recusa reformular novamente 
 * e sugere fecho para não aborrecer o utilizador.
 */

import type { InternalState } from '../../../types/internalState';

export interface ClarificationOutput {
  reformulatedQuestion: string;
  canClarifyAgain: boolean;
  exitLine: string | null;
}

export function buildClarification(intentTag: string, state: InternalState): ClarificationOutput {
  const mem = state.caseMemory;
  
  // Sprint 9: Evita reformulação múltipla ou loop da mesma tag
  const attempts = mem.clarificationRecord?.[intentTag] ?? 0;
  const isAlreadyClarified = attempts >= 1;

  if (isAlreadyClarified) {
    return {
      reformulatedQuestion: '',
      canClarifyAgain: false,
      exitLine: 'Vamos fechar por esta via para não estarmos a insistir em ângulos que não estão a bater certo contigo. É preferível retomarmos com mente limpa.'
    };
  }

  // 1. Extrair contexto real
  const focus = mem.currentFocus ?? 'este assunto';
  const hypothesis = mem.provisionalHypothesis ?? 'o que está a acontecer';

  // 2. Simplificações mapeadas por intentTag
  let reformulated = '';

  switch (intentTag) {
    // Aprofundamentos clássicos do Continuation
    case 'hidden_function':
      reformulated = `Se de repente acordasses amanhã e ${focus} não existisse, que outra decisão ou esforço é que se tornaria imediatamente o teu problema principal?`;
      break;
    
    case 'relief_vs_control':
    case 'cost_visibility':
      reformulated = `Pensa nos últimos dias: o que é que já não tens energia ou paciência para fazer que antes fazias sem pensar, só porque ${focus} está a gastar-te por baixo?`;
      break;

    // Discriminações iniciais
    case 'primary_vs_competing':
      const comp = mem.competingHypothesis ?? 'a outra hipótese';
      reformulated = `Não penses nas causas. Pensa só no peso. Entre sentires [${hypothesis}] e [${comp}], qual é a que te atira mais de rastos no fim do dia?`;
      break;

    case 'organic_vs_reactive':
      reformulated = `Isto aparece do nada como uma gripe, ou é a resposta matemática às coisas que te aconteceram nos últimos dias?`;
      break;

    case 'contextual_vs_systemic':
      reformulated = `Se fosses de férias durante 3 semanas, isto acalmava e desaparecia, ou a cabeça ficava exactamente igual a pensar nas mesmas coisas?`;
      break;

    case 'emotional_vs_functional':
      reformulated = `Sentes mais que isto é uma tristeza/frustração que não consegues tirar, ou que simplesmente o cérebro/corpo entrou em falha técnica e não avança?`;
      break;

    // Tags de follow-up / Reading Checkpoint
    case 'emergent_reading_check':
      reformulated = `Simplificando: a leitura que apresentou toca no ponto central, ou parece que estou a analisar as coisas à revelia da realidade?`;
      break;

    default:
      // Fallback universal: pergunta mais pragmática e humilde
      reformulated = `Se tivesses de explicar a um amigo porque é que isto está a ser tão difícil de resolver agora, o que é que lhe dizias numa frase?`;
      break;
  }

  return {
    reformulatedQuestion: reformulated,
    canClarifyAgain: true,
    exitLine: null
  };
}
