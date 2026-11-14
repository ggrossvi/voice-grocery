'use client';

/**
 * useVoiceAssistant Hook
 * 
 * Manages voice & text interactions, staple confirmations, and live store option selections.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceStatus, PendingConfirmation, FavoriteItem, KrogerProduct } from '@/lib/types';
import { splitSpokenGroceryList } from '@/lib/voice-intent';
import {
  isDeliberateSpeechCancel,
  estimateSpeechTimeoutMs,
  createSpeechCompletion,
  shouldCancelBeforeSpeaking,
  getTranscriptToProcess,
  SpeechCompletion,
} from '@/lib/speech-events';
import {
  initializeItemQueue,
  advanceItemQueue,
  shouldClearQueueOnIntent,
} from '@/lib/item-queue';

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

export function useVoiceAssistant(
  onItemAdded?: (item: FavoriteItem | KrogerProduct) => void,
  selectedStoreId?: string
) {
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
  const relistenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startListeningRef = useRef<() => void>(() => {});
  const itemQueueRef = useRef<string[]>([]);

  // Latest pending confirmation, readable from browser callbacks (like
  // recognition.onend) without going through a setState updater.
  const pendingConfirmationRef = useRef<PendingConfirmation | null>(null);

  // The "speech finished" tracker for the sentence currently being spoken.
  // Cancelled when the user taps stop or a newer sentence replaces it.
  const speechCompletionRef = useRef<SpeechCompletion | null>(null);

  useEffect(() => {
    pendingConfirmationRef.current = state.pendingConfirmation;
  }, [state.pendingConfirmation]);

  const clearRelistenTimer = useCallback(() => {
    if (relistenTimeoutRef.current) {
      clearTimeout(relistenTimeoutRef.current);
      relistenTimeoutRef.current = null;
    }
  }, []);

  /**
   * Schedules the microphone to automatically re-open 400ms after the assistant
   * finishes speaking so the user can confirm an item or add additional items hands-free.
   */
  const scheduleRelisten = useCallback(() => {
    clearRelistenTimer();
    relistenTimeoutRef.current = setTimeout(() => {
      startListeningRef.current();
    }, 400);
  }, [clearRelistenTimer]);

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

    const synth = window.speechSynthesis;

    // A newer sentence replaces any older one: the older sentence's follow-up
    // step (advance queue / reopen mic) must not run.
    speechCompletionRef.current?.cancel();

    // Runs exactly once: on onend, on a real onerror, or when the safety timer
    // fires because Chrome never reported that speech finished.
    const completion = createSpeechCompletion(() => {
      setState(prev => ({ ...prev, status: prev.pendingConfirmation ? 'confirming' : 'idle' }));
      if (onComplete) onComplete();
    }, estimateSpeechTimeoutMs(text));
    speechCompletionRef.current = completion;

    try {

      // Only cancel when something is actually playing: Chrome can silently
      // drop a speak() that comes right after cancel().
      const needsCancel = shouldCancelBeforeSpeaking({
        speaking: synth.speaking,
        pending: synth.pending,
      });
      if (needsCancel) synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = synth.getVoices();
      const naturalVoice = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
      );
      if (naturalVoice) utterance.voice = naturalVoice;

      setState(prev => ({ ...prev, status: 'speaking', assistantSpeech: text }));

      utterance.onend = () => {
        completion.finish();
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        // A deliberate cancel (user tapped stop, or a newer utterance replaced this one)
        // is not "finished talking". Skip the follow-up step so the queue does not
        // advance and the mic does not reopen after the user stopped it.
        // We also skip the status update: whoever cancelled already owns the status.
        if (isDeliberateSpeechCancel(event?.error)) {
          completion.cancel();
          return;
        }

        completion.finish();
      };

      const startSpeaking = () => {
        // The user tapped stop (or a newer sentence started) during the pause.
        if (speechCompletionRef.current !== completion) return;
        synth.resume(); // un-sticks a paused Chrome speech engine
        synth.speak(utterance);
      };

      // After a cancel(), give Chrome a moment before speaking again.
      if (needsCancel) {
        setTimeout(startSpeaking, 100);
      } else {
        startSpeaking();
      }
    } catch (e) {
      completion.finish();
    }
  }, []);

  const processTranscript = useCallback(async (
    transcriptText: string,
    currentConfirmation: PendingConfirmation | null,
    isVoiceInput: boolean = true
  ) => {
    // If user says "I'm done" or "that's all", clear any remaining queued items immediately
    if (shouldClearQueueOnIntent(transcriptText)) {
      itemQueueRef.current = [];
    }

    // Check if the user spoke a multi-item list (e.g. "spinach, eggs and brussel sprouts")
    // Only split when NOT waiting on a pending confirmation (so "yes", "no" etc. aren't split)
    let itemToProcess = transcriptText;
    if (!currentConfirmation && !shouldClearQueueOnIntent(transcriptText)) {
      const splitItems = splitSpokenGroceryList(transcriptText);
      if (splitItems.length > 1) {
        const { currentItem, remainingQueue } = initializeItemQueue(splitItems);
        itemQueueRef.current = remainingQueue;
        if (currentItem) {
          itemToProcess = currentItem;
        }
      }
    }

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
          transcript: itemToProcess,
          pendingConfirmation: currentConfirmation,
          locationId: selectedStoreId,
        }),
      });

      const data = await response.json();
      const shouldContinueListening = isVoiceInput && Boolean(data.continueListening);

      if (data.type === 'CONFIRMATION_NEEDED' || data.type === 'OPTIONS_NEEDED') {
        setState(prev => ({
          ...prev,
          status: 'confirming',
          isProcessing: false,
          assistantSpeech: data.spokenResponse,
          pendingConfirmation: data.pendingConfirmation,
        }));

        if (shouldContinueListening) {
          speak(data.spokenResponse, () => {
            scheduleRelisten();
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

        // If items remain in queue, automatically pop and process the next item
        const { nextItem, remainingQueue } = advanceItemQueue(itemQueueRef.current);
        itemQueueRef.current = remainingQueue;

        if (nextItem) {
          speak(data.spokenResponse, () => {
            // Automatically process next queued item without waiting for user to speak
            setTimeout(() => {
              processTranscript(nextItem, null, isVoiceInput);
            }, 500);
          });
        } else if (shouldContinueListening) {
          speak(data.spokenResponse, () => {
            scheduleRelisten();
          });
        } else {
          speak(data.spokenResponse);
        }
      } else if (data.type === 'CANCELLED') {
        setState(prev => ({
          ...prev,
          status: 'idle',
          isProcessing: false,
          assistantSpeech: data.spokenResponse,
          pendingConfirmation: null,
        }));

        // If user cancelled this specific item but more items exist in queue, advance to next
        const { nextItem, remainingQueue } = advanceItemQueue(itemQueueRef.current);
        itemQueueRef.current = remainingQueue;

        if (nextItem) {
          speak(data.spokenResponse, () => {
            setTimeout(() => {
              processTranscript(nextItem, null, isVoiceInput);
            }, 500);
          });
        } else if (shouldContinueListening) {
          speak(data.spokenResponse, () => {
            scheduleRelisten();
          });
        } else {
          speak(data.spokenResponse);
        }
      } else {
        setState(prev => ({
          ...prev,
          status: 'idle',
          isProcessing: false,
          assistantSpeech: data.spokenResponse,
          pendingConfirmation: null,
        }));
        if (shouldContinueListening) {
          speak(data.spokenResponse, () => {
            scheduleRelisten();
          });
        } else {
          speak(data.spokenResponse);
        }
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
  }, [speak, onItemAdded, selectedStoreId, scheduleRelisten]);

  /**
   * Hardware-only shutdown: stops the relisten timer, speech output and the
   * active recognition session. It deliberately does NOT touch the item queue,
   * because startListening() calls this every time it reopens the mic mid-list.
   */
  const pauseMicrophone = useCallback(() => {
    clearRelistenTimer();
    isListeningRef.current = false;
    // Stop the speech safety timer so it can't advance the queue after a stop.
    speechCompletionRef.current?.cancel();
    speechCompletionRef.current = null;
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
    if (activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.stop();
      } catch (e) {}
      activeRecognitionRef.current = null;
    }
    setState(prev => ({ ...prev, status: 'idle' }));
  }, [clearRelistenTimer]);

  /**
   * User-initiated cancel (tapping stop). Ends the whole grocery session:
   * clears any queued items AND turns the microphone off.
   */
  const stopListening = useCallback(() => {
    itemQueueRef.current = [];
    pauseMicrophone();
  }, [pauseMicrophone]);

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

    // Only pause the mic here; stopListening() would wipe the queued items.
    pauseMicrophone();

    try {
      window.speechSynthesis?.cancel();
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalCaptured = '';
      let latestInterim = '';

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
        latestInterim = interim;
        setState(prev => ({ ...prev, transcript: finalCaptured || interim }));
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        activeRecognitionRef.current = null;

        // Send the request OUTSIDE of setState. React may run setState updaters
        // twice (Strict Mode), which used to send every phrase to the server twice.
        const textToProcess = getTranscriptToProcess(finalCaptured, latestInterim);
        if (textToProcess) {
          processTranscript(textToProcess, pendingConfirmationRef.current, true);
        } else {
          setState(prev => (prev.status === 'listening' ? { ...prev, status: 'idle' } : prev));
        }
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
  }, [pauseMicrophone, processTranscript]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  useEffect(() => {
    return () => {
      clearRelistenTimer();
      speechCompletionRef.current?.cancel();
    };
  }, [clearRelistenTimer]);

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
      if (data.success) {
        setState(prev => ({
          ...prev,
          status: 'idle',
          isProcessing: false,
          pendingConfirmation: null,
          assistantSpeech: `Added ${product.description} to your Kroger cart and saved it as your favorite ${keyword}!`,
        }));

        if (onItemAdded) {
          onItemAdded(data.item || product);
        }

        // Advance to next queued item if one exists
        const { nextItem, remainingQueue } = advanceItemQueue(itemQueueRef.current);
        itemQueueRef.current = remainingQueue;

        if (nextItem) {
          speak(`Added ${product.description} to your Kroger cart!`, () => {
            setTimeout(() => {
              processTranscript(nextItem, null, true);
            }, 500);
          });
        } else {
          speak(`Added ${product.description} to your Kroger cart and saved it as your favorite!`);
        }
      }
    } catch (err) {
      console.error('Failed to add selected option:', err);
      setState(prev => ({ ...prev, status: 'idle', isProcessing: false }));
    }
  }, [state.pendingConfirmation, onItemAdded, speak, processTranscript]);

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
