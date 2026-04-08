import { useEffect, useCallback } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { sttAdapter } from './speechInputAdapter';
import { ttsAdapter } from './speechOutputAdapter';
import type { VoiceStatus } from '../../types/internalState';

export function useVoiceController() {
  const voiceState = useSessionStore(s => s.voiceState);
  
  // Setters wrap
  const updateVoiceState = (update: Partial<typeof voiceState>) => {
    useSessionStore.setState(s => ({
      ...s,
      voiceState: { ...s.voiceState, ...update }
    }));
  };

  // Avaliação ao montar
  useEffect(() => {
    updateVoiceState({
      isSupportedSTT: sttAdapter.isSupported(),
      isSupportedTTS: ttsAdapter.isSupported()
    });
    // Cleanup ao desmontar
    return () => {
      sttAdapter.stop();
      ttsAdapter.stop();
    };
  }, []);

  const changeStatus = (status: VoiceStatus) => updateVoiceState({ status });

  // Lógica de falar (TTS)
  const speakLine = useCallback((text: string, onPlayEnded?: () => void) => {
    if (!voiceState.isSupportedTTS || !voiceState.audioModeEnabled) {
      onPlayEnded?.();
      return;
    }

    // Stop Escutar se for TTS
    sttAdapter.stop();
    changeStatus('speaking');

    ttsAdapter.speakBlocked(text, () => {
      // Quando termina:
      changeStatus('idle');
      if (onPlayEnded) onPlayEnded();
    });
  }, [voiceState.isSupportedTTS, voiceState.audioModeEnabled]);

  // Lógica de Escutar (STT)
  const startListening = useCallback((
    onFinalTranscript: (text: string) => void,
    onInterimUpdate?: (text: string) => void
  ) => {
    if (!voiceState.isSupportedSTT) return;

    // Se estiver a falar, abortar a fala instantaneamente (Interrupt by User)
    if (ttsAdapter.isSpeaking()) {
      ttsAdapter.stop();
    }

    let lastCompletedString = '';

    sttAdapter.start({
      onStart: () => {
        changeStatus('listening');
        lastCompletedString = '';
      },
      onResult: (transcriptChunk, isFinal) => {
        if (isFinal) {
           lastCompletedString += (lastCompletedString ? ' ' : '') + transcriptChunk;
           // Mandado em stream para UI ver enquanto respira (fallback input behavior)
           onInterimUpdate?.(lastCompletedString);
           // Nota da Decisão: 
           // Após a pausa prolongada, a engine de voz fará trigger no "onEnd".
           // Como estamos na política de segurança máxima (não queremos autosubmits cegos que orem triagens erradas),
           // nós alimentaremos o "draft" da input box text mas é o user que aperta Enviar.
        } else {
           const merged = lastCompletedString ? lastCompletedString + ' ' + transcriptChunk : transcriptChunk;
           updateVoiceState({ transcriptDraft: merged });
           onInterimUpdate?.(merged);
        }
      },
      onError: (err) => {
        updateVoiceState({ lastError: err, status: 'error' });
        // Depois de erro reverte para idle ao fim de uns segundos
        setTimeout(() => changeStatus('idle'), 2000);
      },
      onEnd: () => {
        // Se ainda for listening, vai para processar e acorda a callback de Final
        useSessionStore.setState(s => {
           if (s.voiceState.status === 'listening') {
              // Já não vamos submeter! 
              // A UI fará push manual da TextBox preenchida, como o User confirmou indiretamente no plano.
              return { ...s, voiceState: { ...s.voiceState, status: 'idle', transcriptDraft: '' }};
           }
           return s;
        });
        
        onFinalTranscript(lastCompletedString);
      }
    });
  }, [voiceState.isSupportedSTT]);

  const stopListening = useCallback(() => {
    if (voiceState.status === 'listening') {
      sttAdapter.stop();
      changeStatus('idle');
    }
  }, [voiceState.status]);

  const stopSpeaking = useCallback(() => {
    if (voiceState.status === 'speaking') {
       ttsAdapter.stop();
       changeStatus('idle');
    }
  }, [voiceState.status]);

  const toggleAudioMode = useCallback((val?: boolean) => {
    const newVal = val !== undefined ? val : !voiceState.audioModeEnabled;
    updateVoiceState({ audioModeEnabled: newVal });
    if (!newVal) {
      stopSpeaking();
      stopListening();
    }
  }, [voiceState.audioModeEnabled, stopSpeaking, stopListening]);

  return {
    voiceState,
    speakLine,
    startListening,
    stopListening,
    stopSpeaking,
    toggleAudioMode
  };
}
