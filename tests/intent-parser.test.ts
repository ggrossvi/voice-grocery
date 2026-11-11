import { describe, it, expect } from 'vitest';

// Pattern extracted from /api/voice/process
const CLEANUP_PATTERNS = [
  /^(can you\s+)?(please\s+)?(add|put|order|get|buy|i want|i need|we need)\s+/i,
  /\s+(to my cart|in my cart|to the list|to my list|to cart)$/i,
  /^(a gallon of|a carton of|a loaf of|a bottle of|a box of|a bag of|some|a|an)\s+/i,
];

function extractGroceryTerm(rawText: string): string {
  let cleaned = rawText.toLowerCase().trim();
  for (const pattern of CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }
  return cleaned;
}

const AFFIRMATIVE_RESPONSES = [
  'yes', 'yeah', 'yep', 'sure', 'add it', 'please', 'yes please', 'do it', 'confirm', 'okay', 'ok', 'yup', 'sounds good'
];

const NEGATIVE_RESPONSES = [
  'no', 'nope', 'cancel', 'never mind', 'stop', 'dont add', "don't add", 'skip', 'different one'
];

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
    const isAffirmative = (text: string) => 
      AFFIRMATIVE_RESPONSES.some(word => text.toLowerCase().includes(word));

    expect(isAffirmative('yes')).toBe(true);
    expect(isAffirmative('Yes please')).toBe(true);
    expect(isAffirmative('sure add it')).toBe(true);
    expect(isAffirmative('sounds good to me')).toBe(true);
    expect(isAffirmative('nope')).toBe(false);
  });

  it('correctly detects negative rejection responses', () => {
    const isNegative = (text: string) => 
      NEGATIVE_RESPONSES.some(word => text.toLowerCase().includes(word));

    expect(isNegative('no')).toBe(true);
    expect(isNegative('cancel that')).toBe(true);
    expect(isNegative('never mind')).toBe(true);
    expect(isNegative('different one')).toBe(true);
    expect(isNegative('yes')).toBe(false);
  });
});
