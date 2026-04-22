/**
 * semanticAssimilationEngine.ts
 * 
 * Sprint 9: Assimilação Semântica e Repair Loop.
 * 
 * Este motor tem a responsabilidade de interpretar a natureza da resposta do utilizador
 * antes de o sistema avançar para a dedução da próxima fase clínica.
 * Ao avaliar o texto, o motor indica se há confusão, desacordo, recusa ou uma pseudo-resposta vaga,
 * orientando o sistema sobre qual comportamento adpotar.
 */

import type { InternalState } from '../../../types/internalState';

export type SemanticCategory = 
  | 'useful_answer' 
  | 'confusion'       // Ex: "não percebi" 
  | 'disagreement'    // Ex: "nada a ver com o que sugeriste"
  | 'correction'      // Ex: "não é tristeza, é frustração" (tem aspeto de correção substantiva)
  | 'refusal'         // Ex: "passo", "não quero falar"
  | 'vague_escape'    // Ex: "pois", "ok", "talvez"
  | 'too_short';      // Em contextos não-livres, menos de X chars.

export interface SemanticClassification {
  category: SemanticCategory;
  /** Representa a confiança (heurística) do parser para esta categoria */
  confidence: number;
  /** Sugestões operacionais injetadas pelo parser */
  shouldAdvance: boolean;
  shouldClarify: boolean;
  shouldRepair: boolean;
  shouldReframe: boolean;
  /** No futuro, poderá conter extração LLM, de momento vazio/null ou com heurística básica */
  extractedMeaning: string | null;
  // Sprint 10: Extração adicional para captura de nuances sem LLM
  candidateFocusShift: string | null;
  candidateHypothesisShift: string | null;
  salientTerms: string[];
  userPhrasingFragments: string[];
}

// ─── Tokens de Classificação ──────────────────────────────────────────────────

const CONFUSION_TOKENS = [
  'não percebi', 'nao percebi', 'não entendi', 'nao entendi', 'não sei o que', 'nao sei o que',
  'sem sentido', 'não compreendo', 'nao compreendo', 'o que significa', 'não percebo', 'nao percebo',
  'não faz sentido', 'nao faz sentido', 'o que queres dizer', 'o que estas a dizer'
];

const REFUSAL_TOKENS = [
  'não quero responder', 'nao quero responder', 'passa', 'skip', 'prefiro não', 'prefiro nao',
  'não vou responder', 'nao vou responder', 'não me apetece', 'nao me apetece', 'não vou dizer',
  'nao vou dizer', 'recuso', 'nao quero falar'
];

const CORRECTION_TOKENS = [
  'não é isso', 'nao é isso', 'não é bem isso', 'nao e bem isso', 'estás enganado', 'estas enganado',
  'não bate certo', 'nao bate certo', 'não é assim', 'nao e assim', 'está errado', 'esta errado',
  'errado', 'mentira', 'nada a ver', 'não tem a ver', 'nada disso', 'não é nada disso'
];

const VAPID_TOKENS = new Set([
  'ok', 'okay', 'sim', 'não', 'nao', 'pois', 'talvez', 'talvez sim',
  'talvez não', 'talvez nao', 'provavelmente', 'sei lá', 'sei la',
  'não sei', 'nao sei', 'mmm', 'hmm', 'hm', 'ah', 'oh', 'yep',
  'yes', 'no', 'maybe', 'perhaps', 'idk', 'dunno', 'ya', 'yea',
  'sure', 'fine', 'alright', 'bem', 'assim', 'pronto', 'exato',
  'exacto', 'certo', 'claro', 'obvio', 'óbvio'
]);

const MIN_SEMANTIC_LENGTH = 10;
const VAPID_MAX_LENGTH = 30;

// ─── Lógica Principal ─────────────────────────────────────────────────────────

export function assimilateInputSemantic(
  input: string, 
  contextType: 'follow_up' | 'discrimination' | 'free',
  state: InternalState
): SemanticClassification {
  const trimmed = input.trim().toLowerCase();
  
  // Limiar 0: Input vazio -> useful_answer falha. Vamos encará-lo tecnicamente como too_short ou vague
  if (trimmed.length === 0) {
     return buildResponse('too_short'); 
  }

  // Se exceder 50 chars, a probabilidade é muito elevada de que seja uma useful_answer 
  // O utilizador não recusa com textões (na maioria das vezes). 
  if (trimmed.length > 50) {
      // Se contiver elementos de correção, marcamos como correção substancial (texto longo mas reorientador).
      // Mas só se as expressões surgirem no início da frase
      const startsWithCorrection = CORRECTION_TOKENS.some((token) => trimmed.startsWith(token));
      if (startsWithCorrection) {
          return buildResponse('correction', extractContent(input, 'correction'));
      }
      return buildResponse('useful_answer', extractContent(input, 'useful_answer'));
  }

  // 1. Deteção de Confusão Média
  if (CONFUSION_TOKENS.some((token) => trimmed.includes(token))) {
      return buildResponse('confusion');
  }

  // 2. Deteção de Recusa e Abandono
  if (REFUSAL_TOKENS.some((token) => trimmed.includes(token))) {
      return buildResponse('refusal');
  }

  // 3. Deteção de Desacordo e Correção 
  if (CORRECTION_TOKENS.some((token) => trimmed.includes(token))) {
      return buildResponse('disagreement', extractContent(input, 'disagreement')); // consideramos um statement curto e puramente discordante
  }

  // 4. Input semânticamente vago (curto) 
  if (trimmed.length <= VAPID_MAX_LENGTH && VAPID_TOKENS.has(trimmed)) {
     return buildResponse('vague_escape');
  }
  
  // Pode ser multi-token, vamos checar tokens com menos de 3 palavras
  if (trimmed.length <= VAPID_MAX_LENGTH && trimmed.split(/\s+/).length <= 3) {
      const isCompletelyVapid = trimmed.split(/\s+/).every((w) => VAPID_TOKENS.has(w));
      if (isCompletelyVapid) {
         return buildResponse('vague_escape');
      }
  }

  // 5. Demasiado Curto para contextTypes exigentes
  if (contextType !== 'free' && trimmed.length < MIN_SEMANTIC_LENGTH) {
      return buildResponse('too_short');
  }

  // Se escapou todas as armadilhas
  return buildResponse('useful_answer', extractContent(input, 'useful_answer'));
}

/**
 * Sprint 10: Heurística síncrona leve para extrair fragmentos e shifts sem LLM.
 */
function extractContent(input: string, category: SemanticCategory) {
   const trimmed = input.trim();
   const lower = trimmed.toLowerCase();
   
   let extractedMeaning: string | null = null;
   let candidateFocusShift: string | null = null;
   let candidateHypothesisShift: string | null = null;
   const salientTerms: string[] = [];
   const userPhrasingFragments: string[] = [];

   if (category === 'correction' || category === 'disagreement') {
      // Tentar apanhar "não é X, é Y" ou "não tem a ver com X, mas com Y"
      const match = lower.match(/(?:não é|nao e|não tem a ver com|nada a ver com)\s+(?:.*?)(?:,| mas sim| é| e sim| mas)\s+(.+)/i);
      if (match && match[1]) {
          const shift = match[1].replace(/[\.\!\?].*$/, '').trim();
          candidateFocusShift = shift;
          extractedMeaning = `Corrigiu o foco para: "${shift}"`;
          salientTerms.push(shift);
          userPhrasingFragments.push(shift);
      } else {
          if (trimmed.length > 5 && trimmed.length < 150) {
              extractedMeaning = `Discordância substancial: "${trimmed}"`;
              userPhrasingFragments.push(trimmed);
          }
      }
   } else if (category === 'useful_answer') {
       extractedMeaning = `Conteúdo útil: "${trimmed.substring(0, 60)}${trimmed.length > 60 ? '...' : ''}"`;
       if (trimmed.length >= 10 && trimmed.length < 200) {
           userPhrasingFragments.push(trimmed);
       }

       // Heurística básica de palavras-chave emocionais / de fricção
       const words = lower.split(/\s+/);
       const strongWords = ['cansaço', 'ansiedade', 'frustração', 'pressão', 'medo', 'sozinho', 'sozinha', 'culpa', 'obrigação', 'trabalho', 'dinheiro', 'relacionamento', 'esgotamento', 'stress', 'vazio'];
       for (const w of words) {
           const cleanW = w.replace(/[,\.\!\?]/g, '');
           if (strongWords.includes(cleanW) && !salientTerms.includes(cleanW)) {
               salientTerms.push(cleanW);
           }
       }
   }

   return { extractedMeaning, candidateFocusShift, candidateHypothesisShift, salientTerms, userPhrasingFragments };
}

/**
 * Utilitário interno para agilizar a criação dos retornos estruturados.
 */
function buildResponse(
  category: SemanticCategory,
  extra: Partial<Omit<SemanticClassification, 'category' | 'confidence' | 'shouldAdvance' | 'shouldClarify' | 'shouldRepair' | 'shouldReframe'>> = {}
): SemanticClassification {
    let shouldAdvance = false;
    let shouldClarify = false;
    let shouldRepair = false;
    let shouldReframe = false;
    
    switch (category) {
       case 'useful_answer': 
           shouldAdvance = true; 
           break;
       case 'confusion': 
           shouldClarify = true; 
           break;
       case 'disagreement': 
       case 'correction':
           shouldRepair = true; 
           break;
       case 'refusal':
       case 'vague_escape':
       case 'too_short':
           shouldReframe = true; 
           break;
    }
  
    return {
       category,
       confidence: 1.0, // Neste sistema puramente heurístico a confiança é estrita
       shouldAdvance,
       shouldClarify,
       shouldRepair,
       shouldReframe,
       extractedMeaning: extra.extractedMeaning ?? null,
       candidateFocusShift: extra.candidateFocusShift ?? null,
       candidateHypothesisShift: extra.candidateHypothesisShift ?? null,
       salientTerms: extra.salientTerms ?? [],
       userPhrasingFragments: extra.userPhrasingFragments ?? []
    };
}
