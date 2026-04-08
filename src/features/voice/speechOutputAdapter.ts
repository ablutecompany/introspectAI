export class SpeechOutputAdapter {
  private synth: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  
  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
      // Pre-load voices (async event in some browsers)
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoice();
      } else {
        this.loadVoice();
      }
    }
  }

  public isSupported(): boolean {
    return !!this.synth;
  }

  private loadVoice() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // Prefer PT-PT voices, otherwise generic PT. 
    // M/F depends on OS default unless we search string ('joana', 'catarina', 'eduardo' on mac)
    let ptVoice = voices.find(v => v.lang === 'pt-PT');
    if (!ptVoice) ptVoice = voices.find(v => v.lang.startsWith('pt'));
    
    // Força uma voz de navegador se existir
    if (ptVoice) this.voice = ptVoice;
  }

  /**
   * Partir blocos grandes em orações para o motor Chrome não fazer timeout aos 15 segundos.
   */
  private chunkText(text: string): string[] {
    // Quebra por ponta final, exclui vazios
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  public speakBlocked(text: string, onEnd?: () => void) {
    if (!this.synth) {
      onEnd?.();
      return;
    }
    
    // Assegura paragem total do que estava a tocar
    this.stop();

    const chunks = this.chunkText(text);
    if (chunks.length === 0) {
      onEnd?.();
      return;
    }

    let completedChunks = 0;

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (this.voice) utterance.voice = this.voice;
      utterance.lang = 'pt-PT';
      utterance.rate = 1.0; // Velocidade normal (nem lesto nem drone)
      utterance.pitch = 1.0;

      utterance.onend = () => {
        completedChunks++;
        if (completedChunks === chunks.length) {
           onEnd?.();
        }
      };

      utterance.onerror = (e) => {
        console.error('TTS Error on utterence', e);
        // Mesmo em erro, garantimos que destranca no final
        completedChunks++;
        if (completedChunks === chunks.length) {
           onEnd?.();
        }
      };

      this.synth!.speak(utterance);
    });
  }

  public stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
  }

  public isSpeaking(): boolean {
    return this.synth ? this.synth.speaking || this.synth.pending : false;
  }
}

export const ttsAdapter = new SpeechOutputAdapter();
