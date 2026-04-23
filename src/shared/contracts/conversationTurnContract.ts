import { z } from 'zod';

export const ConversationTurnOutputSchema = z.object({
  assistantText: z.string().describe('O texto conversacional a mostrar ao utilizador. Curto e focado, em português (PT-PT).'),
  didUnderstand: z.boolean().describe('Verdadeiro se o modelo compreendeu a mensagem e não houve confusão extrema.'),
  detectedIntent: z.enum(['useful_answer', 'correction', 'disagreement', 'confusion', 'refusal', 'vague'])
    .describe('A classificação central da intenção do utilizador neste turno.'),
  updatedFocus: z.string().nullable().describe('Foco atualizado se houver um candidateFocusShift claro na mensagem.'),
  updatedHypothesis: z.string().nullable().describe('Hipótese provisória atualizada se houver uma clara, ou null se não aplicável.'),
  needsClarification: z.boolean().describe('Verdadeiro se precisar de dar retry/clarificar com o utilizador antes de avançar.'),
  clarificationText: z.string().nullable().describe('Texto de clarificação, obrigatório se needsClarification for true.'),
  nextMove: z.enum(['ask_more', 'proceed', 'close_now']).describe('Decisão tática para a FSM.'),
  targetStage: z.string().nullable().describe('Estágio alvo explícito para forçar transição FSM, se aplicável.'),
  closeNow: z.boolean().describe('Flag secundária de segurança para encerrar prematuramente se recusa total.')
});

export type ConversationTurnOutput = z.infer<typeof ConversationTurnOutputSchema>;

export interface ConversationTurnRequest {
  sessionStage: string;
  currentFocus: string | null;
  provisionalHypothesis: string | null;
  caseMemory: Record<string, any>; // Simplified for the contract
  lastUserInput: string;
  workingDirection: string | null;
  lastAssistantMove: string | null;
  checkpointState: string | null;
  correctionHistory: string[];
}
