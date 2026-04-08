export const GOVERNANCE_TEMPLATES = {
  // A. reconhecer alongamento
  ACKNOWLEDGE_LOAD: "Percebo que isto já se estendeu mais do que seria ideal para uma primeira leitura.",

  // B. pedir extensão
  ASK_EXTENSION: (missingElement: string, maxQs: number) => 
    `Ainda me falta distinguir ${missingElement}. Se tolerares, fazia só mais ${maxQs === 1 ? 'uma pergunta curta' : maxQs + ' perguntas curtas'} antes de fechar. Ou, se preferires, avanço já com o que tenho.`,

  // C. concluir sem estender
  CLOSE_WITHOUT_EXTENSION: "Já tenho material suficiente para não te puxar mais. Vou fechar esta parte com o que já ficou claro.",

  // D. parar por baixo retorno
  CLOSE_LOW_RETURN: "Consigo continuar a afinar, mas o ganho adicional já não justifica muito mais carga. Eu fecharia isto aqui.",

  // E. responder a meta-conversa (rejeição do método)
  ACKNOWLEDGE_META: "Tens razão. Estou a insistir onde já havia material suficiente. Em vez de puxar mais, vou fechar esta parte."
};
