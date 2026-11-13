import { describe, it, expect } from 'vitest';
import {
  extractGroceryTerm,
  didUserSayYes,
  didUserSayNo,
} from '../src/lib/voice-intent';

describe('Natural Language Intent Parser', () => {
  it('isolates clean grocery terms from varied speech patterns', () => {
    expect(extractGroceryTerm('I want milk')).toBe('milk');
    expect(extractGroceryTerm('can you please add some eggs to my cart')).toBe('eggs');
    expect(extractGroceryTerm('a gallon of whole milk')).toBe('whole milk');
    expect(extractGroceryTerm('order bananas to my list')).toBe('bananas');
    expect(extractGroceryTerm('we need sourdough bread')).toBe('sourdough bread');
    expect(extractGroceryTerm('yogurt')).toBe('yogurt');
  });

  it('correctly detects affirmative confirmation responses', () => {
    expect(didUserSayYes('yes')).toBe(true);
    expect(didUserSayYes('Yes please')).toBe(true);
    expect(didUserSayYes('sure add it')).toBe(true);
    expect(didUserSayYes('sounds good to me')).toBe(true);
    expect(didUserSayYes('nope')).toBe(false);
  });

  it('correctly detects negative rejection responses', () => {
    expect(didUserSayNo('no')).toBe(true);
    expect(didUserSayNo('cancel that')).toBe(true);
    expect(didUserSayNo('never mind')).toBe(true);
    expect(didUserSayNo('different one')).toBe(true);
    expect(didUserSayNo('yes')).toBe(false);
  });
});
