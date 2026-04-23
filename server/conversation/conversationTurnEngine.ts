import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { 
  ConversationTurnOutputSchema, 
  type ConversationTurnOutput, 
  type ConversationTurnRequest 
} from '../../src/shared/contracts/conversationTurnContract';

/**
 * ConversationTurnEngine
 * 
 * O núcleo LLM da aplicação. Recebe um payload rigoroso de estado e devolve
 * um output validado pelo schema, determinando intenção, ajustando estado
 * e decidindo o próximo movimento conversacional sem ditar a interface.
 */
export class ConversationTurnEngine {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  public async processTurn(request: ConversationTurnRequest): Promise<ConversationTurnOutput> {
    const phaseInstructions = this.getPhaseInstructions(request.sessionStage);

    const systemPrompt = `
És o motor conversacional central de uma app de exploração psicológica bounded.
Não assumes o papel de chatbot livre. Lês o estado atual, avalias o input do utilizador e determinas a progressão.

ESTADO ATUAL:
- Session Stage: ${request.sessionStage}
- Case Summary: ${request.caseSummary || 'Nenhum'}
- Current Focus: ${request.currentFocus || 'Nenhum'}
- Current Hypothesis: ${request.currentHypothesis || 'Nenhuma'}
- Last Assistant Turn: ${request.lastAssistantTurn || 'Nenhum'}
- Correções passadas nesta sessão: ${request.previousCorrections.length > 0 ? request.previousCorrections.join(' | ') : 'Nenhum registo'}
- Termos salientes: ${request.salientTerms.length > 0 ? request.salientTerms.join(', ') : 'Nenhum'}

REGRAS GERAIS:
1. Responde em Português de Portugal (PT-PT) natural e direto. Sem banalidades, sem estilo coach, sem diagnóstico formal.
2. Faz no máximo UMA pergunta principal por turno. Não faças 3 perguntas de uma vez.
3. Se houver discordância ou confusão por parte do utilizador, adapta-te imediatamente (understanding_status = 'disagreement' ou 'confused').
4. Se precisares de clarificar antes de avançar, needs_clarification=true e fornece a clarification_text.
5. Usa next_action ('ask_more', 'proceed', 'clarify', 'close_now') para guiar a FSM. Se já tiveres material suficiente, emite 'proceed' ou checkpoint_signal=true.

INSTRUÇÕES ESPECÍFICAS DA FASE (${request.sessionStage}):
${phaseInstructions}
`.trim();

    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.lastUserInput },
        ],
        response_format: zodResponseFormat(ConversationTurnOutputSchema, 'turn_output'),
        temperature: 0.1, // Alta previsibilidade
      });

      const parsedOutput = completion.choices[0]?.message.parsed;

      if (!parsedOutput) {
        throw new Error('Falha no parsing estruturado do output LLM.');
      }

      return parsedOutput;
    } catch (error) {
      console.error('[ConversationTurnEngine] Erro de API/Parsing:', error);
      
      // Fallback estruturado para garantir bounded fail-safe
      return {
        assistant_text: "Tive uma falha de conexão e não consegui processar a última mensagem. Podes repetir?",
        user_input_interpretation: "Erro na API",
        understanding_status: "insufficient",
        next_action: "clarify",
        target_stage: null,
        updated_focus: null,
        updated_hypothesis: null,
        needs_clarification: true,
        clarification_text: "Ocorreu um erro de rede. Queres tentar de novo?",
        checkpoint_signal: false,
        close_session: false,
        suggested_ui_mode: 'warning',
        suggested_shortcuts: ['Tentar novamente']
      };
    }
  }

  private getPhaseInstructions(stage: string): string {
    switch (stage) {
      case 'TRIAGE':
        return "- O objetivo é captar o problema base de forma rápida.\n- Pergunta sobre o sintoma principal.\n- Se sentires que já tens a 'dor' principal mapeada, usa next_action = 'proceed'.";
      case 'REENTRY':
        return "- O utilizador está a voltar de uma pausa ou rejeitou a leitura anterior.\n- Reconecta com empatia e tenta perceber o que falhou na fase anterior.\n- Atualiza o focus e hypothesis rapidamente.";
      case 'EXPLORATION':
        return "- A fase principal. Explora o contexto, gatilhos e padrões.\n- Aprofunda a hypothesis. Quando sentires que a hypothesis é sólida e cobriste os pontos fundamentais, define checkpoint_signal=true.";
      case 'CHECKPOINT':
        return "- Estamos num momento de validação. O utilizador acabou de ler um insight.\n- Pergunta apenas como lhe soa a leitura. Se discordar, ajusta. Se concordar, usa next_action = 'proceed'.";
      case 'CLOSING':
        return "- A conversa está a terminar.\n- Consolida o que foi descoberto, sugere um passo muito simples e fecha (close_session=true) se o utilizador concordar.";
      default:
        return "- Mantém a conversa fluída e ajusta-te ao utilizador.";
    }
  }
}
