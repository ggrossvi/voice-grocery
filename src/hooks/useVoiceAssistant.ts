'use client';

/**
 * useVoiceAssistant Hook
 * 
 * Manages voice & text interactions, staple confirmations, and live store option selections.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceStatus, PendingConfirmation, UsualItem, KrogerProduct } from '@/lib/types';

interface VoiceAssistantState {
  status: VoiceStatus;
  transcript: string;
  assistantSpeech: string;
  pendingConfirmation: PendingConfirmation | null;
  errorMessage: string | null;
  isSupported: boolean;
  isInsecureHttp: boolean;
  isProcessing: boolean;
}

export function useVoiceAssistant(onItemAdded?: (item: UsualItem) => void) {
  const [state, setState] = useState<VoiceAssistantState>({
    status: 'idle',
    transcript: '',
    assistantSpeech: "Tap the mic or type below (e.g. 'milk' or 'yogurt')",
    pendingConfirmation: null,
    errorMessage: null,
    isSupported: true,
    isInsecureHttp: false,
    isProcessing: false,
  });

  const activeRecognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSpeechAPI = Boolean(
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      );

      const isInsecure = !window.isSecureContext && 
        window.location.hostname !== 'localhost' && 
        window.location.hostname !== '127.0.0.1';

      setState(prev => ({
        ...prev,
        isSupported: hasSpeechAPI,
        isInsecureHttp: isInsecure,
      }));
    }
  }, []);

  const speak = useCallback((text: string, onComplete?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onComplete) onComplete();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
      );
      if (naturalVoice) utterance.voice = naturalVoice;

      setState(prev => ({ ...prev, status: 'speaking', assistantSpeech: text }));

      utterance.onend = () => {
        setState(prev => ({ ...prev, status: prev.pendingConfirmation ? 'confirming' : 'idle' }));
        if (onComplete) onComplete();
      };

      utterance.onerror = () => {
        setState(prev => ({ ...prev, status: 'idle' }));
        if (onComplete) onComplete();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      if (onComplete) onComplete();
    }
  }, []);

  const processTranscript = useCallback(async (
    transcriptText: string,
    currentConfirmation: PendingConfirmation | null,
    isVoiceInput: boolean = true
  ) => {
    setState(prev => ({ 
      ...prev, 
      status: 'thinking', 
      transcript: transcriptText,
      isProcessing: true,
      errorMessage: null,
    }));

    try {
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          pendingConfirmation: currentConfirmation,
        }),
      });

      const data = await response.json();

      if (data.type === 'CONFIRMATION_NEEDED' || data.type === 'OPTIONS_NEEDED') {
        setState(prev => ({
          ...prev,
          status: 'confirming',
          isProcessing: false,
          assistantSpeech: data.spokenResponse,
          pendingConfirmation: data.pendingConfirmation,
        }));

        if (isVoiceInput) {
          speak(data.spokenResponse, () => {
            setTimeout(() => startListening(), 400);
          });
        } else {
          speak(data.spokenResponse);
        }
      } else if (data.type === 'ITEM_ADDED') {
        setState(prev => ({
          ...prev,
          status: 'idle',
          isProcessing: false,
          assistantSpeech: data.spokenResponse,
          pendingConfirmation: null,
        }));
        if (onItemAdded && data.addedItem) {
          onItemAdded(data.addedItem);
        }
        speak(data.spokenResponse);
      } else {
        setState(prev => ({
          ...prev,
          status: 'idle',
          isProcessing: false,
          assistantSpeech: data.spokenResponse,
          pendingConfirmation: null,
        }));
        speak(data.spokenResponse);
      }
    } catch (err: any) {
      console.error('Error processing query:', err);
      setState(prev => ({
        ...prev,
        status: 'idle',
        isProcessing: false,
        assistantSpeech: "Sorry, I had trouble connecting to Kroger. Please try again.",
      }));
    }
  }, [speak, onItemAdded]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.stop();
      } catch (e) {}
      activeRecognitionRef.current = null;
    }
    setState(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permErr: any) {
        setState(prev => ({
          ...prev,
          status: 'idle',
          errorMessage: 'Microphone permission denied. Use the text input below.',
        }));
        return;
      }
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState(prev => ({
        ...prev,
        errorMessage: 'Speech recognition is not supported in this browser. Use text input below.',
      }));
      return;
    }

    stopListening();

    try {
      window.speechSynthesis?.cancel();
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalCaptured = '';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setState(prev => ({
          ...prev,
          status: 'listening',
          transcript: '',
          errorMessage: null,
        }));
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalCaptured += trans;
          } else {
            interim += trans;
          }
        }
        setState(prev => ({ ...prev, transcript: finalCaptured || interim }));
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        activeRecognitionRef.current = null;

        setState(prev => {
          const textToProcess = (finalCaptured || prev.transcript).trim();
          if (textToProcess) {
            processTranscript(textToProcess, prev.pendingConfirmation, true);
          } else if (prev.status === 'listening') {
            return { ...prev, status: 'idle' };
          }
          return prev;
        });
      };

      recognition.onerror = (event: any) => {
        isListeningRef.current = false;
        activeRecognitionRef.current = null;
        if (event.error !== 'no-speech') {
          setState(prev => ({
            ...prev,
            status: 'idle',
            errorMessage: event.error === 'not-allowed' ? 'Microphone permission denied' : `Audio error: ${event.error}`,
          }));
        } else {
          setState(prev => ({ ...prev, status: 'idle' }));
        }
      };

      activeRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        errorMessage: 'Could not activate microphone. Use text input below.',
      }));
    }
  }, [stopListening, processTranscript]);

  const submitTextQuery = useCallback((query: string) => {
    if (!query.trim()) return;
    processTranscript(query.trim(), state.pendingConfirmation, false);
  }, [processTranscript, state.pendingConfirmation]);

  const confirmPendingItem = useCallback((confirmed: boolean) => {
    if (!state.pendingConfirmation) return;
    processTranscript(confirmed ? 'yes' : 'no', state.pendingConfirmation, false);
  }, [processTranscript, state.pendingConfirmation]);

  /**
   * Selects a specific product from the live Kroger options list
   */
  const selectProductOption = useCallback(async (product: KrogerProduct) => {
    const keyword = state.pendingConfirmation?.keyword || product.description.split(' ')[0].toLowerCase();
    setState(prev => ({ ...prev, status: 'thinking', isProcessing: true }));

    try {
      const response = await fetch('/api/kroger/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: product,
          quantity: 1,
          spokenKeyword: keyword,
        }),
      });

      const data = await response.json();
      if (data.success && data.item) {
        setState(prev => ({
          ...prev,
          status: 'idle',
          isProcessing: false,
          pendingConfirmation: null,
          assistantSpeech: `Added ${product.description} to your Kroger cart and saved it as your usual ${keyword}!`,
        }));

        if (onItemAdded) {
          onItemAdded(data.item);
        }
        speak(`Added ${product.description} to your Kroger cart and saved it as your usual!`);
      }
    } catch (err) {
      console.error('Failed to add selected option:', err);
      setState(prev => ({ ...prev, status: 'idle', isProcessing: false }));
    }
  }, [state.pendingConfirmation, onItemAdded, speak]);

  return {
    ...state,
    startListening,
    stopListening,
    submitTextQuery,
    confirmPendingItem,
    selectProductOption,
    speak,
  };
}
