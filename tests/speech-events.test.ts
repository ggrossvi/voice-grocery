import { describe, it, expect } from 'vitest';
import { isDeliberateSpeechCancel } from '../src/lib/speech-events';

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

