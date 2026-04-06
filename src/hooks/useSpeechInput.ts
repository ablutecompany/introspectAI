import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Browser não suporta captura de voz nativa.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-PT';

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event: any) => {
       if(event.error === 'no-speech') return; // ignore common silence timeouts
       console.error("Speech API Error: ", event.error);
       setError(`Erro no microfone: ${event.error}`);
       setIsListening(false);
    };

    recognition.onend = () => {
       setIsListening(false);
    };

    recognitionRef.current = recognition;
    
    return () => {
       recognitionRef.current?.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setError(null);
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch(e) {
        // Handle race conditions where it's already started
      }
    }
  };

  const manualSetTranscript = (text: string) => {
     setTranscript(text);
  };

  return {
    isListening,
    transcript,
    error,
    toggleListening,
    manualSetTranscript,
    isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };
}
