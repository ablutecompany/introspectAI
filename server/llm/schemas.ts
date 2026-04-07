import { z } from 'zod';

export const LLMInterviewResponseSchema = z.object({
  nextMoveType: z.enum([
    'ask_field',
    'ask_nature',
    'ask_function',
    'ask_cost',
    'ask_contrast',
    'ask_refinement',
    'deliver_latent_reading',
    'deliver_guidance',
    'ask_extension_permission',
    'deliver_close',
    'ask_resume_preference',
    'ask_continuation_mode',
    'recenter',
    'simplify'
  ]),
  userFacingText: z.string().min(2).max(800),
  
  extractedCaseStructure: z.object({
    caseField: z.string().optional(),
    surfaceTheme: z.string().optional(),
    surfaceNature: z.string().optional(),
    primaryFunction: z.string().optional(),
    mainCost: z.string().optional(),
    contrastResolution: z.string().optional(),
    openAmbiguities: z.array(z.string()).default([])
  }).optional(),

  extractedLatentModel: z.object({
    deeperTheme: z.string().optional(),
    latentHypothesis: z.string().optional(),
    centralTension: z.string().optional(),
    maintenanceLoop: z.string().optional(),
    hiddenCost: z.string().optional(),
    confidenceLevel: z.enum(['insufficient', 'moderate', 'strong']).optional()
  }).optional(),

  extractedGuidance: z.object({
    repositioningFrame: z.string().optional(),
    keyDistinction: z.string().optional(),
    prematureActionToAvoid: z.string().optional(),
    microStep: z.string().optional(),
    nextQuestionIfNeeded: z.string().optional()
  }).optional(),

  detectedGovernanceSignals: z.object({
    metaConversationDetected: z.boolean().default(false),
    fatigueSignals: z.array(z.string()).default([])
  }).optional()
});
