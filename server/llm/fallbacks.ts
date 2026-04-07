import type { LLMNextMoveType, LLMInterviewResponse } from '../../shared/contracts/interviewContract.js';

// Fallbacks para quando o LLM falha ou devolve JSON inválido.
// Estes são respostas de segurança — nunca devem usar a blacklist de comportamentos.
// Cada fallback inclui a estrutura completa esperada para aquela fase.

export const FALLBACKS: Record<LLMNextMoveType, LLMInterviewResponse> = {

  ask_field: {
    nextMoveType: 'ask_field',
    userFacingText: 'Isto pesa-te mais em que zona?',
    extractedCaseStructure: { openAmbiguities: [] }
  },

  ask_nature: {
    nextMoveType: 'ask_nature',
    userFacingText: 'O centro disto parece-te mais o quê?',
    extractedCaseStructure: { openAmbiguities: [] }
  },

  ask_function: {
    nextMoveType: 'ask_function',
    userFacingText: 'Quando isto ganha força, o que é que te dá mais?',
    extractedCaseStructure: { openAmbiguities: [] }
  },

  ask_cost: {
    nextMoveType: 'ask_cost',
    userFacingText: 'E o preço mais real disto tem sido onde?',
    extractedCaseStructure: { openAmbiguities: [] }
  },

  ask_contrast: {
    nextMoveType: 'ask_contrast',
    userFacingText: 'O que te prende mais aqui: a pessoa, o que isso te dá, ou a versão de ti que aparece com isto?',
    extractedCaseStructure: { openAmbiguities: [] }
  },

  ask_refinement: {
    nextMoveType: 'ask_refinement',
    userFacingText: 'Quando isto aparece, sentes mais expansão ou alívio?',
    extractedCaseStructure: { openAmbiguities: [] }
  },

  ask_extension_permission: {
    nextMoveType: 'ask_extension_permission',
    userFacingText: 'Percebo que isto já se estendeu mais do que seria ideal. Ainda me falta afinar um ponto. Se tolerares, fazia só mais uma pergunta curta antes de fechar. Ou avanço já com o que tenho.',
    extractedCaseStructure: { openAmbiguities: [] }
  },

  deliver_latent_reading: {
    nextMoveType: 'deliver_latent_reading',
    userFacingText: 'Com o que partilhaste, tenho a impressão de que isto não é sobretudo o que parece à superfície. Parece-me mais sobre o que aquilo te devolve — uma versão de ti que funciona de forma diferente. O preço pode estar menos no custo óbvio e mais naquilo que não consegues aceder enquanto isto ocupa esse espaço.',
    extractedLatentModel: {
      deeperTheme: 'identidade e função compensatória',
      latentHypothesis: 'O fenómeno parece servir uma função de regulação menos visível do que o foco aparente sugere.',
      centralTension: 'entre o que se quer e o que se evita',
      maintenanceLoop: 'O ganho imediato impede a confrontação com o custo mais fundo.',
      hiddenCost: 'Perda progressiva de acesso a outras dimensões de si mesmo.',
      confidenceLevel: 'moderate'
    }
  },

  deliver_guidance: {
    nextMoveType: 'deliver_guidance',
    userFacingText: 'Por agora, eu não trataria isto principalmente como um problema a resolver. Tratava-o mais como um sinal a ler. Antes de agir, convém separar o que isto serve do que isto esconde. O que eu não faria já era tomar uma decisão grande com base nesta pressão. Nos próximos dias, observa apenas quando é que isto aparece — e o que estava a acontecer imediatamente antes.',
    extractedGuidance: {
      repositioningFrame: 'Não um problema a resolver, mas um sinal a ler.',
      keyDistinction: 'Separar o que isto serve do que isto esconde.',
      prematureActionToAvoid: 'Tomar uma decisão grande com base nesta pressão.',
      microStep: 'Observar quando é que isto aparece e o que estava a acontecer imediatamente antes.',
      nextQuestionIfNeeded: null
    }
  },

  deliver_close: {
    nextMoveType: 'deliver_close',
    userFacingText: 'Fica com isto por agora. O próximo passo não é resolver — é observar o que resulta do micro-passo. Se quiseres retomar, começo de onde ficámos.',
  },

  ask_resume_preference: {
    nextMoveType: 'ask_resume_preference',
    userFacingText: 'Da última vez ficou uma hipótese aberta sobre o que isto pode ser. Queres continuar daí, corrigir essa base, ou começar de outro ângulo?',
  },

  ask_continuation_mode: {
    nextMoveType: 'ask_continuation_mode',
    userFacingText: 'Queres que eu refine melhor a compreensão antes de avançarmos, ou preferes trabalhar já a partir do que ficou percebido?',
  },

  recenter: {
    nextMoveType: 'recenter',
    userFacingText: 'Tens razão. Estou a insistir onde já havia material suficiente. Em vez de puxar mais, vou fechar com a melhor leitura que consigo agora.',
    detectedGovernanceSignals: { metaConversationDetected: true, fatigueSignals: [] }
  },

  simplify: {
    nextMoveType: 'simplify',
    userFacingText: 'Simplificando: o que pesa mais nisto agora?',
  },
};
