import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDeliberateSpeechCancel,
  estimateSpeechTimeoutMs,
  createSpeechCompletion,
  shouldCancelBeforeSpeaking,
  getTranscriptToProcess,
  MIN_SPEECH_TIMEOUT_MS,
  MAX_SPEECH_TIMEOUT_MS,
} from '../src/lib/speech-events';

describe('isDeliberateSpeechCancel', () => {
  it('treats "canceled" (speechSynthesis.cancel()) as a deliberate cancel', () => {
    expect(isDeliberateSpeechCancel('canceled')).toBe(true);
  });

  it('treats "interrupted" (a new utterance replaced this one) as a deliberate cancel', () => {
    expect(isDeliberateSpeechCancel('interrupted')).toBe(true);
  });

  it('treats real speech failures as NOT a deliberate cancel', () => {
    expect(isDeliberateSpeechCancel('synthesis-failed')).toBe(false);
    expect(isDeliberateSpeechCancel('audio-busy')).toBe(false);
    expect(isDeliberateSpeechCancel('not-allowed')).toBe(false);
  });

  it('Edge Case: a missing or empty error code is NOT treated as a cancel', () => {
    expect(isDeliberateSpeechCancel(undefined)).toBe(false);
    expect(isDeliberateSpeechCancel('')).toBe(false);
  });
});


describe('estimateSpeechTimeoutMs', () => {
  it('Edge Case: an empty string gets the minimum timeout', () => {
    expect(estimateSpeechTimeoutMs('')).toBe(MIN_SPEECH_TIMEOUT_MS);
  });

  it('a short phrase gets the minimum timeout', () => {
    expect(estimateSpeechTimeoutMs('Added milk!')).toBe(MIN_SPEECH_TIMEOUT_MS);
  });

  it('a longer sentence gets more time than a shorter one', () => {
    const shorter = 'Found your favorite milk for three dollars. Would you like me to add it?';
    const longer = `${shorter} I am still listening, or say I am done when you are finished shopping today.`;
    expect(estimateSpeechTimeoutMs(longer)).toBeGreaterThan(estimateSpeechTimeoutMs(shorter));
    expect(estimateSpeechTimeoutMs(shorter)).toBeGreaterThan(MIN_SPEECH_TIMEOUT_MS);
  });

  it('Edge Case: a very long text is capped at the maximum timeout', () => {
    const veryLong = 'word '.repeat(500);
    expect(estimateSpeechTimeoutMs(veryLong)).toBe(MAX_SPEECH_TIMEOUT_MS);
  });
});

describe('createSpeechCompletion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs onComplete only once even if finish() is called twice', () => {
    const onComplete = vi.fn();
    const completion = createSpeechCompletion(onComplete, 3000);

    completion.finish();
    completion.finish();

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('runs onComplete when the safety timer fires (browser never sent onend)', () => {
    const onComplete = vi.fn();
    createSpeechCompletion(onComplete, 3000);

    vi.advanceTimersByTime(2999);
    expect(onComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('Edge Case: onend followed by the safety timer still runs onComplete only once', () => {
    const onComplete = vi.fn();
    const completion = createSpeechCompletion(onComplete, 3000);

    completion.finish(); // browser fired onend
    vi.advanceTimersByTime(5000); // timer would have fired afterwards

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('Edge Case: after cancel() (user tapped stop), onComplete never runs', () => {
    const onComplete = vi.fn();
    const completion = createSpeechCompletion(onComplete, 3000);

    completion.cancel();
    vi.advanceTimersByTime(5000);
    completion.finish();

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('Edge Case: works without an onComplete callback', () => {
    const completion = createSpeechCompletion(undefined, 3000);
    expect(() => {
      completion.finish();
      vi.advanceTimersByTime(5000);
    }).not.toThrow();
  });
});

describe('shouldCancelBeforeSpeaking', () => {
  it('does NOT cancel when the speech engine is idle (avoids Chrome dropping the next speak)', () => {
    expect(shouldCancelBeforeSpeaking({ speaking: false, pending: false })).toBe(false);
  });

  it('cancels when something is currently speaking', () => {
    expect(shouldCancelBeforeSpeaking({ speaking: true, pending: false })).toBe(true);
  });

  it('cancels when something is queued to speak', () => {
    expect(shouldCancelBeforeSpeaking({ speaking: false, pending: true })).toBe(true);
  });
});

describe('getTranscriptToProcess', () => {
  it('prefers the final transcript over the interim one', () => {
    expect(getTranscriptToProcess('eggs and milk', 'eggs and')).toBe('eggs and milk');
  });

  it('falls back to the interim transcript when there is no final text', () => {
    expect(getTranscriptToProcess('', 'bananas')).toBe('bananas');
  });

  it('Edge Case: falls back to interim when the final text is only whitespace', () => {
    expect(getTranscriptToProcess('   ', 'bananas')).toBe('bananas');
  });

  it('trims surrounding whitespace', () => {
    expect(getTranscriptToProcess('  spinach  ', '')).toBe('spinach');
  });

  it('Edge Case: returns null for empty or whitespace-only input', () => {
    expect(getTranscriptToProcess('', '')).toBeNull();
    expect(getTranscriptToProcess('   ', '  ')).toBeNull();
  });
});
