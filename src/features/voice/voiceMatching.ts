import type { FrictionArea } from '../../types/internalState';

/**
 * Basic heuristic mapping from spoken raw text to internal triage chips.
 * This is used primarily when the app uses Speech-To-Text during Triagem.
 */
export function matchVoiceToTriageArea(transcript: string): FrictionArea | 'unmatched' {
  const norm = transcript.toLowerCase();

  // A: Corpo
  if (/corpo|f[íi]sico|sintomas|pesco[çc]o|som[áa]tico|costas|tensão f[íi]sica/i.test(norm)) return 'A';

  // B: Energia
  if (/cansa[çc]o|exaust|energia|dormir|bateria|arrastar|exausto|exausta/i.test(norm)) return 'B';

  // C: Mente
  if (/mente|ansiedade|ansios|pensar|cabe[çc]a a roda|ru[íi]do/i.test(norm)) return 'C';

  // D: Sobrecarga
  if (/sobrecarga|caos|desorganiza|tempo|muita coisa|ca[óo]tico/i.test(norm)) return 'D';

  // E: Relações
  if (/rela[çc][õo]es|conflito|pessoas|família|isolamento|sozinho|sozinha|discut/i.test(norm)) return 'E';

  // F: Sentido
  if (/sentido|vazio|prop[óo]sito|perdido|perdida|bloqueio|orienta[çc][ãa]o/i.test(norm)) return 'F';

  // G: Misto / Difuso
  if (/misto|n[ãa]o sei|tudo misturado|vários|nenhum/i.test(norm)) return 'G';

  return 'unmatched';
}

/**
 * Maps spoken binary responses like "Sim", "Não", "Bate certo" for Governance and Confirmations
 */
export function matchBinVoiceResponse(transcript: string): boolean | 'unmatched' {
  const norm = transcript.toLowerCase();
  
  if (/sim|claro|bate certo|faz sentido|é isso|pode ser/i.test(norm)) return true;
  if (/n[ãa]o|errado|longe disso|de todo/i.test(norm)) return false;

  return 'unmatched';
}
