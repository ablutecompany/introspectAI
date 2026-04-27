import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { 
  ConversationTurnOutputSchema, 
  type ConversationTurnOutput, 
  type ConversationTurnRequest 
} from '../../src/shared/contracts/conversationTurnContract.js';

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
    // Solução robusta para ESM/CJS interop em serverless runtimes
    const OpenAIClass = (OpenAI as any).default || OpenAI;
    this.openai = new OpenAIClass({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  public async processTurn(request: ConversationTurnRequest): Promise<ConversationTurnOutput> {
    const phaseInstructions = this.getPhaseInstructions(request.sessionStage);

    const systemPrompt = `
És o motor conversacional central de uma app de exploração psicológica bounded.
A tua função não é interpretar precocemente nem dar diagnósticos ou fechos vagos.
A tua função é conversar com subtileza para localizar o foco real da fricção, discriminar entre focos rivais, aprofundar e fechar com uma tarefa concreta.

ESTADO ATUAL:
- Session Stage: ${request.sessionStage}
- Case Summary: ${request.caseSummary || 'Nenhum'}
- Current Focus: ${request.currentFocus || 'Nenhum'}
- Current Hypothesis: ${request.currentHypothesis || 'Nenhuma'}
- Last Assistant Turn: ${request.lastAssistantTurn || 'Nenhum'}
- Correções passadas: ${request.previousCorrections?.length ? request.previousCorrections.join(' | ') : 'Nenhuma'}

OS 4 MODOS OPERACIONAIS (Deves inferir em que modo estás e declará-lo em current_mode):
1. LOCALIZAR_FOCO: Abertura. Deixa a conversa fluir. Faz perguntas abertas e curtas. Mapeia probabilidades internamente.
2. AFINAR_FOCO: Só entra aqui se houver 2 focos rivais fortes. Faz uma pergunta discriminatória clara (ex: "Sentes mais peso por X ou evitas Y?").
3. APROFUNDAR_FOCO: Quando o foco é claro. Pergunta pelo que mantém o problema ativo, custos ou padrões.
4. FECHO_DINAMICO: Fim da sessão. Emite next_action="assign_work" e preenche o objecto concrete_task com uma tarefa estritamente acionável.

REGRAS GERAIS:
1. Responde em PT-PT natural. Sem estilo coach. Sem banalidades.
2. Faz UMA pergunta por turno.
3. Não uses jargão (ex: "ansiedade", "sobrecarga") antes do utilizador.
4. Mapeia probabilidades passivamente (focus_probabilities).
5. Quando sentires que a exploração terminou, passa para FECHO_DINAMICO e define assign_work.

INSTRUÇÕES ESPECÍFICAS:
${phaseInstructions}

IMPORTANTE: Responde EXCLUSIVAMENTE em formato JSON validando o schema:
{
  "assistant_text": "string",
  "user_input_interpretation": "string",
  "understanding_status": "clear" | "confused" | "insufficient" | "disagreement",
  "current_mode": "LOCALIZAR_FOCO" | "AFINAR_FOCO" | "APROFUNDAR_FOCO" | "FECHO_DINAMICO",
  "focus_probabilities": {
    "trabalho_dinheiro": number,
    "relacao_perda_solidao": number,
    "corpo_energia_sono": number,
    "decisao_evitamento": number,
    "sentido_rumo_vazio": number,
    "misto_difuso": number
  },
  "next_action": "clarify" | "ask_more" | "proceed" | "assign_work" | "close_now",
  "target_stage": "string" | null,
  "updated_focus": "string" | null,
  "updated_hypothesis": "string" | null,
  "needs_clarification": boolean,
  "clarification_text": "string" | null,
  "close_session": boolean,
  "concrete_task": { "action": "string", "duration": "string", "trigger": "string", "observable": "string" } | null,
  "suggested_ui_mode": "normal" | "warning" | "insight" | null,
  "suggested_shortcuts": ["string"]
}
`.trim();

    try {
      console.log(\`[LLM Engine] Chamando OpenAI (gpt-4o-mini)... Stage: \${request.sessionStage}\`);
      const llmStart = Date.now();
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.lastUserInput || '' },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const llmDuration = Date.now() - llmStart;
      const rawContent = completion.choices[0]?.message?.content;

      if (!rawContent) {
        throw new Error('OpenAI retornou conteúdo vazio.');
      }

      const parsedOutput = ConversationTurnOutputSchema.parse(JSON.parse(rawContent));
      console.log(\`[LLM Engine] Resposta processada em \${llmDuration}ms. Action: \${parsedOutput.next_action}, Mode: \${parsedOutput.current_mode}\`);
      return parsedOutput;
    } catch (error: any) {
      console.error('[LLM Engine] Erro de API/Parsing:', error);
      
      const isTimeout = error.code === 'ETIMEDOUT' || error.name === 'TimeoutError';
      
      return {
        assistant_text: \`[FALLBACK ENGINE] Erro: \${error.message || 'Erro desconhecido'}\`,
        user_input_interpretation: "Erro Engine",
        understanding_status: "insufficient",
        current_mode: "LOCALIZAR_FOCO",
        focus_probabilities: {
          trabalho_dinheiro: 0, relacao_perda_solidao: 0, corpo_energia_sono: 0,
          decisao_evitamento: 0, sentido_rumo_vazio: 0, misto_difuso: 0
        },
        next_action: "clarify",
        target_stage: null,
        updated_focus: null,
        updated_hypothesis: null,
        needs_clarification: true,
        clarification_text: isTimeout ? "Ocorreu um timeout. Repete por favor." : "Tive uma falha técnica.",
        close_session: false,
        concrete_task: null,
        suggested_ui_mode: 'warning',
        suggested_shortcuts: ['Tentar novamente']
      };
    }
  }

  private getPhaseInstructions(stage: string): string {
    switch (stage) {
      case 'TRIAGE':
      case 'REENTRY':
        return "- Início do fluxo. Começa levemente no MODO 1: LOCALIZAR_FOCO. Descobre o peso da queixa.";
      case 'EXPLORATION':
        return "- MODO 2 ou MODO 3. Procura o detalhe. Transita para FECHO_DINAMICO (assign_work) apenas se o foco e mecânicas estiverem bem sólidos.";
      case 'CHECKPOINT':
        return "- Validação final do foco com o utilizador.";
      case 'CLOSING':
        return "- MODO 4: FECHO_DINAMICO obrigatoriamente. Cria uma tarefa objetiva, quantificável e temporal. Despede-te brevemente.";
      default:
        return "- Mantém o modo focado e avança progressivamente.";
    }
  }
}
