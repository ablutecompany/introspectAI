import { z } from 'zod';

export const ConversationTurnOutputSchema = z.object({
  assistant_text: z.string()
    .describe('O texto da resposta do bot. Em PT-PT natural, direto. Máx 1 pergunta. Sem banalidades ou estilo coach.'),
  user_input_interpretation: z.string()
    .describe('Uma breve análise (interna) sobre o que o utilizador quis realmente dizer.'),
  understanding_status: z.enum(['clear', 'confused', 'insufficient', 'disagreement']),
  current_mode: z.enum(['LOCALIZAR_FOCO', 'AFINAR_FOCO', 'APROFUNDAR_FOCO', 'FECHO_DINAMICO'])
    .describe('O modo de exploração atual em que o motor se encontra.'),
  focus_probabilities: z.object({
    trabalho_dinheiro: z.number().min(0).max(1),
    relacao_perda_solidao: z.number().min(0).max(1),
    corpo_energia_sono: z.number().min(0).max(1),
    decisao_evitamento: z.number().min(0).max(1),
    sentido_rumo_vazio: z.number().min(0).max(1),
    misto_difuso: z.number().min(0).max(1)
  }).describe('Probabilidade (0-1) para cada macro-foco de tensão baseada no historial.'),
  next_action: z.enum(['clarify', 'ask_more', 'proceed', 'assign_work', 'close_now'])
    .describe('Decisão FSM. assign_work quando pronto para fechar com tarefa concreta.'),
  target_stage: z.string().nullable(),
  updated_focus: z.string().nullable()
    .describe('Nome do foco ganhador/atual, e.g. "corpo_energia_sono", se for claro. Null caso contrário.'),
  updated_hypothesis: z.string().nullable()
    .describe('Hipótese clínica/operacional se detetada de forma forte. Null se não.'),
  needs_clarification: z.boolean(),
  clarification_text: z.string().nullable(),
  close_session: z.boolean(),
  concrete_task: z.object({
    action: z.string().describe('O que o utilizador vai fazer concretamente.'),
    duration: z.string().describe('Durante quanto tempo (ex: 7 dias).'),
    trigger: z.string().describe('Quando o faz (ex: no fim do dia).'),
    observable: z.string().describe('O que vai observar/registar (ex: contar pedras).')
  }).nullable().describe('Tarefa operacional final. Preenchida apenas quando next_action é assign_work.'),
  suggested_ui_mode: z.enum(['normal', 'warning', 'insight']).nullable(),
  suggested_shortcuts: z.array(z.string()).describe('Até 3 sugestões curtas.')
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
