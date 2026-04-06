export type UserIntent = 'substantive' | 'vague' | 'deflective' | 'dont_know' | 'simplify_request' | 'not_me_request';

export class InputClassifier {
  static classify(text: string): UserIntent {
    const normalized = text.toLowerCase().trim();
    
    if (normalized.length === 0) return 'substantive'; // UI should block empty, but fallback
    
    // Exact or partial matches
    if (['não sei', 'nao sei', 'nem sei', 'não faço ideia', 'sei lá', 'sei la'].includes(normalized)) {
      return 'dont_know';
    }
    
    if (['não é bem isso', 'nao é isso', 'errado', 'nada a ver', 'não sou eu'].includes(normalized)) {
      return 'not_me_request';
    }
    
    const vaguePhrases = ['mais ou menos', 'talvez', 'um bocado', 'coisas', 'não sei bem como explicar'];
    if (vaguePhrases.some(p => normalized.includes(p)) && normalized.length < 20) {
      return 'vague';
    }

    const simplifyPhrases = ['explica melhor', 'como assim?', 'o que queres dizer', 'não entendi'];
    if (simplifyPhrases.some(p => normalized.includes(p))) {
      return 'simplify_request';
    }

    const deflectivePhrases = ['ah isso é normal', 'todos passam por isso', 'não interessa muito', 'deixa para lá', 'outra coisa'];
    if (deflectivePhrases.some(p => normalized.includes(p))) {
      return 'deflective';
    }
    
    return 'substantive';
  }
}
