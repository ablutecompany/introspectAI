import { z } from 'zod';

export const ConversationTurnOutputSchema = z.object({
  assistant_text: z.string()
    .describe('O texto da resposta do bot. Em PT-PT natural, direto. Máx 1 pergunta. Sem banalidades ou estilo coach.'),
  user_input_interpretation: z.string()
    .describe('Uma breve análise (interna) sobre o que o utilizador quis realmente dizer ou insinuar.'),
  understanding_status: z.enum(['clear', 'confused', 'insufficient', 'disagreement'])
    .describe('Qualidade da compreensão deste turno.'),
  next_action: z.enum(['clarify', 'ask_more', 'proceed', 'close_now'])
    .describe('A decisão tática FSM recomendada pelo LLM para o fluxo da conversa.'),
  target_stage: z.string().nullable()
    .describe('Se o utilizador pedir explicitamente para saltar de fase, indicar a fase alvo. Caso contrário, null.'),
  updated_focus: z.string().nullable()
    .describe('Novo foco clínico/de trabalho identificado neste turno. Null se não alterar.'),
  updated_hypothesis: z.string().nullable()
    .describe('Nova hipótese provisória baseada na resposta, se houver uma pista forte. Null se não alterar.'),
  needs_clarification: z.boolean()
    .describe('Verdadeiro se não for possível avançar sem clarificar a resposta vaga/confusa.'),
  clarification_text: z.string().nullable()
    .describe('A pergunta exata de clarificação a fazer. Obrigatório se needs_clarification=true.'),
  checkpoint_signal: z.boolean()
    .describe('Verdadeiro se o modelo julgar que já reuniu dados suficientes para saltar para o Reading Checkpoint.'),
  close_session: z.boolean()
    .describe('Verdadeiro se o utilizador pediu explicitamente para cancelar/parar a sessão definitivamente.'),
  suggested_ui_mode: z.enum(['normal', 'warning', 'insight']).nullable()
    .describe('Sugestão de mood para a UI adaptar cores, se desejado. Null por defeito.'),
  suggested_shortcuts: z.array(z.string())
    .describe('Até 3 sugestões de respostas curtas (quick replies) para botões na UI.')
});

export type ConversationTurnOutput = z.infer<typeof ConversationTurnOutputSchema>;

export interface ConversationTurnRequest {
  sessionStage: 'TRIAGE' | 'REENTRY' | 'EXPLORATION' | 'CHECKPOINT' | 'CLOSING' | string;
  caseSummary: string; // Curto
  currentFocus: string | null;
  currentHypothesis: string | null;
  lastUserInput: string;
  lastAssistantTurn: string | null;
  checkpointState: string | null;
  conversationDepth: number;
  previousCorrections: string[];
  salientTerms: string[];
  constraints?: string[];
}
