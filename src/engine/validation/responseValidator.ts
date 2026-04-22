/**
 * responseValidator.ts
 *
 * Sprint 5: Validação Mínima de Resposta.
 *
 * Filtro leve — nunca punitivo — que impede que respostas semanticamente
 * vazias (tipo "ok", "pois", "talvez") façam avançar o fluxo como se
 * fossem material clínico útil.
 *
 * Regras:
 * - 'empty'  : string vazia ou só whitespace
 * - 'too_short': < 10 chars (só para contextos 'follow_up' e 'discrimination')
 * - 'vapid'  : token semanticamente vazio (lista curta e conservadora)
 *              só aplica quando a resposta tem < 30 chars no total
 *
 * Não bloqueia contextos 'free' por comprimento — nesse modo é mais permissivo.
 *
 * Ponto de extensão: Sprint 6+ pode tornar a lista de tokens dependente
 * do idioma ou do foco do caso.
 */

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type RejectionReason = 'empty' | 'too_short' | 'vapid' | null;

export interface ValidationResult {
  /** Verdadeiro se a resposta tem conteúdo semântico mínimo. */
  isValid: boolean;
  /** Razão de rejeição, ou null se válido. */
  rejectionReason: RejectionReason;
  /** Mensagem a mostrar ao utilizador (gentil, não acusatória). */
  feedbackMessage: string | null;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

/**
 * Tokens que, sozinhos ou em conjunto, não constituem resposta clínica útil.
 * Lista conservadora — só adicionamos quando existe consenso claro.
 */
const VAPID_TOKENS = new Set([
  'ok', 'okay', 'sim', 'não', 'nao', 'pois', 'talvez', 'talvez sim',
  'talvez não', 'talvez nao', 'provavelmente', 'sei lá', 'sei la',
  'não sei', 'nao sei', 'mmm', 'hmm', 'hm', 'ah', 'oh', 'yep',
  'yes', 'no', 'maybe', 'perhaps', 'idk', 'dunno', 'ya', 'yea',
  'sure', 'fine', 'alright', 'bem', 'assim', 'pronto', 'exato',
  'exacto', 'certo', 'claro', 'obvio', 'óbvio', 'obvio',
]);

/**
 * Mensagens de feedback a rodar por índice (determinístico por tamanho da resposta).
 * Nunca acusatórias — convidam a mais sem pressionar.
 */
const FEEDBACK_MESSAGES = [
  'Preciso de um pouco mais para conseguir trabalhar isto.',
  'Isso ainda não me ajuda a perceber em que direção seguir.',
  'Conta-me um pouco mais — mesmo uma frase curta já ajuda.',
];

const MIN_SEMANTIC_LENGTH = 10;
const VAPID_MAX_LENGTH = 30; // só aplica vapid check em respostas curtas

// ─── Função principal ──────────────────────────────────────────────────────────

/**
 * Valida se uma resposta tem conteúdo semântico mínimo para avançar no fluxo.
 *
 * @param input Texto bruto da resposta do utilizador
 * @param contextType Contexto da pergunta — determina quão restritivo ser
 */
export function validateMinimumResponse(
  input: string,
  contextType: 'follow_up' | 'discrimination' | 'free'
): ValidationResult {
  const trimmed = input.trim();

  // ─── Regra 1: Vazio absoluto ────────────────────────────────────────────────
  if (!trimmed) {
    return makeInvalid('empty', 0);
  }

  // ─── Regra 2: Demasiado curto (só em contextos clínicos) ───────────────────
  if (contextType !== 'free' && trimmed.length < MIN_SEMANTIC_LENGTH) {
    // Verificar se é vapid antes de decidir a mensagem
    const lowerTrimmed = trimmed.toLowerCase();
    if (VAPID_TOKENS.has(lowerTrimmed)) {
      return makeInvalid('vapid', trimmed.length);
    }
    return makeInvalid('too_short', trimmed.length);
  }

  // ─── Regra 3: Token vapid (em respostas curtas) ─────────────────────────────
  if (trimmed.length <= VAPID_MAX_LENGTH) {
    const lowerTrimmed = trimmed.toLowerCase();
    // Verificar a frase inteira E cada token individualmente
    if (
      VAPID_TOKENS.has(lowerTrimmed) ||
      (trimmed.split(/\s+/).length <= 3 &&
        trimmed.split(/\s+/).every((w) => VAPID_TOKENS.has(w.toLowerCase())))
    ) {
      return makeInvalid('vapid', trimmed.length);
    }
  }

  // ─── Resposta válida ────────────────────────────────────────────────────────
  return { isValid: true, rejectionReason: null, feedbackMessage: null };
}

// ─── Utilitário interno ────────────────────────────────────────────────────────

/**
 * Constrói um resultado de rejeição com mensagem de feedback rotativa.
 * O índice é determinístico pelo comprimento — sem randomness.
 */
function makeInvalid(reason: RejectionReason, inputLength: number): ValidationResult {
  const msgIndex = inputLength % FEEDBACK_MESSAGES.length;
  return {
    isValid: false,
    rejectionReason: reason,
    feedbackMessage: FEEDBACK_MESSAGES[msgIndex],
  };
}
