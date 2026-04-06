import type { LLMNextMoveType, LLMInterviewResponse } from '../../shared/contracts/interviewContract';

export const FALLBACKS: Record<LLMNextMoveType, LLMInterviewResponse> = {
  ask_open: {
    nextMoveType: 'ask_open',
    userFacingText: "Compreendo. Podes falar um pouco mais sobre como isso te impacta no dia a dia?",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'insufficient' }
  },
  ask_concrete_example: {
    nextMoveType: 'ask_concrete_example',
    userFacingText: "Isso soa um pouco difuso. Podes dar-me um exemplo concreto de quando isso aconteceu recentemente?",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'insufficient' }
  },
  ask_cost: {
    nextMoveType: 'ask_cost',
    userFacingText: "Percebo o contexto. Mas onde é que sentes que isto te está a custar mais? Energia, sono, paciência?",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'insufficient' }
  },
  ask_fear: {
    nextMoveType: 'ask_fear',
    userFacingText: "Se isto continuar assim, o que é que mais receias que possa acontecer?",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'moderate' }
  },
  ask_desired_life: {
    nextMoveType: 'ask_desired_life',
    userFacingText: "Apesar dessa fricção, qual seria o cenário que realmente desejavas recuperar?",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'moderate' }
  },
  recenter: {
    nextMoveType: 'recenter',
    userFacingText: "Entendo. Para não nos perdermos do ponto principal: isto pesa mais porque te deixa exausto ou pela falta de margem de escolha?",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'moderate' }
  },
  simplify: {
    nextMoveType: 'simplify',
    userFacingText: "Falando de forma simples: o que é que está, nesta fase, a bloquear-te mais?",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'insufficient' }
  },
  contrast: {
    nextMoveType: 'contrast',
    userFacingText: "Por um lado, falas deste desgaste, mas por outro foges ativamente disso. Sentes que o problema é a falta de apoio ou apenas tentares carregar tudo sozinho?",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'moderate' }
  },
  deliver_outcome: {
    nextMoveType: 'deliver_outcome',
    userFacingText: "Obrigado por partilhares isto. Com base no que me disseste, acho que já temos pistas suficientes para fechar esta primeira leitura. Avança.",
    extractedSignals: { contexts: [], costs: [], fears: [], mechanisms: [] },
    suggestedUpdates: { confidenceHint: 'strong' }
  }
};
