// Declared globally for TS
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type STTConfig = {
  lang?: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onStart: () => void;
  onEnd: () => void;
  onError: (errorMessage: string) => void;
};

export class SpeechInputAdapter {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor() {
    this.init();
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  private init() {
    if (!this.isSupported()) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configurações standard STT Contínuo para PT-PT
    this.recognition.continuous = true; 
    this.recognition.interimResults = true; 
  }

  public start(config: STTConfig) {
    if (!this.recognition) return;
    if (this.isListening) return;

    this.recognition.lang = config.lang || 'pt-PT';

    this.recognition.onstart = () => {
      this.isListening = true;
      config.onStart();
    };

    /**
     * Interim Results são os textos em "streaming" visuais, 
     * IsFinal significa que a API entende que a o utilizador parou aquela frase inteira.
     */
    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Se há texto consolidado, enviamos isFinal
      if (finalTranscript) {
        config.onResult(finalTranscript, true);
      } else if (interimTranscript) {
        config.onResult(interimTranscript, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      // "no-speech" isn't a hard error, just end of stream usually
      if (event.error !== 'no-speech') {
        config.onError(event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      config.onEnd();
    };

    try {
      this.recognition.start();
    } catch(e: any) {
      config.onError('could_not_start');
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}

export const sttAdapter = new SpeechInputAdapter();
