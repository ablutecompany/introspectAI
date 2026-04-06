import { z } from 'zod';

export const LLMInterviewResponseSchema = z.object({
  nextMoveType: z.enum([
    'ask_open',
    'ask_concrete_example',
    'ask_cost',
    'ask_fear',
    'ask_desired_life',
    'recenter',
    'simplify',
    'contrast',
    'deliver_outcome'
  ]),
  userFacingText: z.string().min(2).max(500),
  extractedSignals: z.object({
    contexts: z.array(z.string()).default([]),
    costs: z.array(z.string()).default([]),
    fears: z.array(z.string()).default([]),
    mechanisms: z.array(z.string()).default([])
  }),
  suggestedUpdates: z.object({
    dominantHypothesis: z.string().optional(),
    confidenceHint: z.enum(['insufficient', 'moderate', 'strong'])
  })
});
