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

