/**
 * Speech Synthesis Event Helpers
 *
 * Small pure helpers for interpreting browser speech events, kept separate
 * from the React hook so they can be unit tested.
 */

/**
 * The error codes a browser reports when an utterance is stopped ON PURPOSE:
 * - "canceled":    `speechSynthesis.cancel()` was called (e.g. user tapped stop).
 * - "interrupted": a new utterance replaced the one that was still speaking.
 *
 * Why this matters: browsers report these as `onerror` events, but they are not
 * real failures. Treating them like "finished talking" would run the follow-up
 * step (advance the queue / reopen the mic) right after the user stopped it.
 */
const DELIBERATE_CANCEL_ERROR_CODES = ['canceled', 'interrupted'];

/**
 * Returns true when a speech error code means "someone stopped this speech on purpose".
 */
export function isDeliberateSpeechCancel(errorCode?: string): boolean {
  if (!errorCode) return false;
  return DELIBERATE_CANCEL_ERROR_CODES.includes(errorCode);
}


// ---------------------------------------------------------------------------
// Safety timeout for speech
// ---------------------------------------------------------------------------

/** Shortest safety timeout, so even "Added milk!" gets time to be spoken. */
export const MIN_SPEECH_TIMEOUT_MS = 3000;

/** Longest safety timeout, so a stuck speech engine never blocks the list for long. */
export const MAX_SPEECH_TIMEOUT_MS = 20000;

/** Generous time per spoken word (normal speech is ~0.4s/word). */
const MS_PER_WORD = 450;

/** Extra cushion for the browser to start talking. */
const SPEECH_START_BUFFER_MS = 2000;

/**
 * Estimates how long the browser should need to say `text` out loud.
 *
 * Why: Chrome sometimes never fires `onend`, which would leave the multi-item
 * list waiting forever. We use this estimate as a safety timer. It is
 * deliberately generous so it does not cut off a sentence that is still playing.
 */
export function estimateSpeechTimeoutMs(text: string): number {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimate = wordCount * MS_PER_WORD + SPEECH_START_BUFFER_MS;
  return Math.min(MAX_SPEECH_TIMEOUT_MS, Math.max(MIN_SPEECH_TIMEOUT_MS, estimate));
}

export interface SpeechCompletion {
  /** Call when the browser says speech finished (onend / real onerror). */
  finish: () => void;
  /** Call when speech was stopped on purpose; onComplete will never run. */
  cancel: () => void;
}

/**
 * Wraps a "speech finished" callback so it runs exactly once, whichever happens
 * first: the browser's `onend`, a real `onerror`, or the safety timer.
 *
 * Why: without this, a silent/stuck speech engine means `onComplete` never runs,
 * so the next queued grocery item is never searched. And without the "once"
 * guard, `onend` + timer could both fire and process the next item twice.
 *
 * `cancel()` is for when the user taps stop or a newer sentence replaces this
 * one: the follow-up step must NOT run in that case.
 */
export function createSpeechCompletion(
  onComplete: (() => void) | undefined,
  timeoutMs: number
): SpeechCompletion {
  let isDone = false;

  const markDone = () => {
    isDone = true;
    clearTimeout(timer);
  };

  const finish = () => {
    if (isDone) return;
    markDone();
    onComplete?.();
  };

  const cancel = () => {
    if (isDone) return;
    markDone();
  };

  const timer = setTimeout(finish, timeoutMs);

  return { finish, cancel };
}

// ---------------------------------------------------------------------------
// Speaking & listening decisions
// ---------------------------------------------------------------------------

/**
 * Decides whether `speechSynthesis.cancel()` is needed before speaking.
 *
 * Why: in Chrome, calling `speak()` right after `cancel()` can be silently
 * dropped. So we only cancel when something is actually speaking or queued.
 */
export function shouldCancelBeforeSpeaking(engine: {
  speaking: boolean;
  pending: boolean;
}): boolean {
  return engine.speaking || engine.pending;
}

/**
 * Picks the text to send to the server when the microphone turns off.
 * Prefers the final transcript, falls back to the interim one, and returns
 * `null` when the user said nothing (so we don't send an empty request).
 */
export function getTranscriptToProcess(
  finalText: string,
  interimText: string
): string | null {
  const text = (finalText || '').trim() || (interimText || '').trim();
  return text ? text : null;
}
