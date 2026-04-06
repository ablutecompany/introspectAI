import type { InternalState } from '../../src/types/internalState';
import type { LLMNextMoveType } from '../../shared/contracts/interviewContract';

export class PromptBuilder {
  static build(
    state: InternalState, 
    userText: string, 
    forcedMove: LLMNextMoveType
  ): { system: string; user: string } {
    
    // Extracted signals for context
    const currentCosts = state.costSignals.join(', ') || 'Nenhum identificado';
    const currentFears = state.fearSignals.join(', ') || 'Nenhum identificado';
    const currentMechs = state.mechanismSignals.join(', ') || 'Nenhum identificado';
    const hypothesis = state.dominantHypothesis || 'Em fase de descoberta';

    const systemPrompt = `
És o motor linguístico do _introspect_AI, concebido para ajudar terapeuticamente através de uma entrevista afunilada. 
O teu papel NÃO é decidir o rumo da entrevista, o Maestro já decidiu.
A tua única função é reformular o output e propor extração de sinais, respondendo estritamente em JSON.

[REGRAS DE TOM E LINGUAGEM]
1. Português de Portugal (sempre).
2. Curto, direto, humano, sem floreados.
3. SEM jargão clínico ou pseudo-profundidade poética.
4. NUNCA resumas o que o utilizador disse. Foca-te apenas no próximo passo.
5. PROIBIDO: "és uma pessoa X", "o teu eixo dominante é Y".

[CONTEXTO DA SESSÃO ATUAL]
Fase: ${state.phase}
Hipótese Atual: ${hypothesis}
Custos Mapeados: ${currentCosts}
Medos Mapeados: ${currentFears}
Defesas/Mecanismos Mapeados: ${currentMechs}

[ORDEM DO MAESTRO PARA ESTE TURNO]
Ação Exigida: ${forcedMove}
- Tu deves adaptar a formulação a esta Ação Exigida.
- Se for 'ask_cost', foca no custo da situação.
- Se for 'recenter', recentra delicadamente.

[FORMATO DE RESPOSTA OBRIGATÓRIO (APENAS JSON)]
{
  "nextMoveType": "${forcedMove}",
  "userFacingText": "(a tua resposta humana conversacional, curta)",
  "extractedSignals": {
    "contexts": ["..."],
    "costs": ["..."],
    "fears": ["..."],
    "mechanisms": ["..."]
  },
  "suggestedUpdates": {
    "dominantHypothesis": "(opcional)",
    "confidenceHint": "(insufficient, moderate ou strong)"
  }
}
`;

    const userPrompt = `O utilizador respondeu na última iteração: "${userText}"`;

    return { system: systemPrompt, user: userPrompt };
  }
}
