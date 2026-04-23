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
    const systemPrompt = `
És o motor conversacional central de uma app de exploração psicológica bounded.
Não assumes o papel de chatbot livre. Lês o estado atual, avalias o input do utilizador e determinas a progressão.

ESTADO ATUAL:
- Session Stage: ${request.sessionStage}
- Current Focus: ${request.currentFocus || 'Nenhum'}
- Provisional Hypothesis: ${request.provisionalHypothesis || 'Nenhuma'}
- Working Direction: ${request.workingDirection || 'Nenhuma'}
- Last Assistant Move: ${request.lastAssistantMove || 'Nenhum'}
- Correções passadas nesta sessão: ${request.correctionHistory.length > 0 ? request.correctionHistory.join(' | ') : 'Nenhum registo'}

INSTRUÇÕES (STRICT):
1. Classifica a intenção (detectedIntent). Se o utilizador corrige o assistente, marca 'correction' ou 'disagreement'.
2. Se houver correção válida e um novo foco/hipótese claro, atualiza-os (updatedFocus, updatedHypothesis).
3. Produz o texto de resposta (assistantText) de forma curta, natural e em Português de Portugal (PT-PT). Sem banalidades ou linguagem coach.
4. Se o input for evasivo ou inútil, didUnderstand=false e needsClarification=true (com clarificationText).
5. nextMove:
   - 'ask_more': ainda precisas de mais input para fechar a fase.
   - 'proceed': consideras que tens material suficiente para a fase seguinte.
   - 'close_now': o utilizador exigiu explicitamente encerrar.
6. targetStage: Se a intenção do utilizador indicar inequivocamente que a fase atual deve ser ignorada para saltar para uma específica, preenche-o (raro). Caso contrário null.
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
        assistantText: "Tive uma falha de conexão e não consegui processar a última mensagem. Podes repetir?",
        didUnderstand: false,
        detectedIntent: 'vague',
        updatedFocus: null,
        updatedHypothesis: null,
        needsClarification: true,
        clarificationText: "Ocorreu um erro de rede. Queres tentar de novo?",
        nextMove: 'ask_more',
        closeNow: false,
      };
    }
  }
}
