import { useState, useCallback } from 'react';

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const speak = useCallback((text: string, onStartCallback?: () => void, onEndCallback?: () => void, onErrorCallback?: () => void, rate: number = 1.02) => {
    if (!('speechSynthesis' in window)) {
        console.warn('TTS não suportado no browser atual');
        if (onErrorCallback) onErrorCallback();
        setTtsError("not_supported");
        return;
    }
    
    // Reset state
    setTtsError(null);
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang === 'pt-PT') || voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;
    
    utterance.lang = 'pt-PT';
    utterance.rate = rate; 
    utterance.pitch = 1.0;

    let hasStarted = false;
    let timeoutId = setTimeout(() => {
       if (!hasStarted) {
          console.warn('TTS failed to start (likely browser autoplay block)');
          window.speechSynthesis.cancel();
          setTtsError("autoplay_blocked");
          if (onErrorCallback) onErrorCallback();
       }
    }, 500); // 500ms block detection window

    utterance.onstart = () => {
       hasStarted = true;
       clearTimeout(timeoutId);
       setIsSpeaking(true);
       if (onStartCallback) onStartCallback();
    };
    
    utterance.onend = () => {
       setIsSpeaking(false);
       if (onEndCallback) onEndCallback();
    };
    
    utterance.onerror = () => {
       hasStarted = true; // prevents timeout racing
       clearTimeout(timeoutId);
       setIsSpeaking(false);
       setTtsError("engine_error");
       if (onErrorCallback) onErrorCallback();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
       window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, ttsError };
};
