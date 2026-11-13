import { describe, it, expect } from 'vitest';
import {
  extractGroceryTerm,
  isUserDoneOrdering,
  didUserSayYes,
  didUserSayNo,
  decideNextVoiceAction,
  itemAddedConfirmationSpokenResponse,
} from '../src/lib/voice-intent';

describe('Continuous Multi-Item Voice Loop Intent Engine', () => {
  describe('isUserDoneOrdering', () => {
    it('recognizes natural phrases for ending a continuous voice session', () => {
      expect(isUserDoneOrdering("I'm done")).toBe(true);
      expect(isUserDoneOrdering('im done')).toBe(true);
      expect(isUserDoneOrdering("That's all")).toBe(true);
      expect(isUserDoneOrdering('thats all')).toBe(true);
      expect(isUserDoneOrdering("That's it")).toBe(true);
      expect(isUserDoneOrdering('nothing else')).toBe(true);
      expect(isUserDoneOrdering('no more items')).toBe(true);
      expect(isUserDoneOrdering('no more')).toBe(true);
      expect(isUserDoneOrdering('no thanks')).toBe(true);
      expect(isUserDoneOrdering('no thank you')).toBe(true);
      expect(isUserDoneOrdering('all done')).toBe(true);
      expect(isUserDoneOrdering('stop listening')).toBe(true);
      expect(isUserDoneOrdering('stop')).toBe(true);
    });

    it('recognizes polite combinations like "no that is all thank you"', () => {
      expect(isUserDoneOrdering("No, that's all thank you")).toBe(true);
      expect(isUserDoneOrdering("I'm all done thanks")).toBe(true);
      expect(isUserDoneOrdering('nothing else for now')).toBe(true);
    });

    it('Edge Case: does NOT mistake grocery items containing "no" or "stop" for stop commands', () => {
      expect(isUserDoneOrdering('non-dairy milk')).toBe(false);
      expect(isUserDoneOrdering('no sugar added yogurt')).toBe(false);
      expect(isUserDoneOrdering('no salt added butter')).toBe(false);
      expect(isUserDoneOrdering('no pulp orange juice')).toBe(false);
      expect(isUserDoneOrdering('gobstoppers')).toBe(false);
      expect(isUserDoneOrdering('organic bananas')).toBe(false);
    });
  });

  describe('decideNextVoiceAction (Context-Aware Turn Resolution)', () => {
    it('Edge Case: returns NO_SPEECH with continueListening=false for empty or whitespace transcripts', () => {
      expect(decideNextVoiceAction('', false)).toEqual({
        intent: 'NO_SPEECH',
        continueListening: false,
      });
      expect(decideNextVoiceAction('   ', true)).toEqual({
        intent: 'NO_SPEECH',
        continueListening: false,
      });
    });

    it('Edge Case: returns NO_SPEECH when filler words contain no actual grocery item', () => {
      expect(decideNextVoiceAction('please add to my cart', false)).toEqual({
        intent: 'NO_SPEECH',
        continueListening: false,
      });
    });

    it('returns CONFIRM_PENDING_ITEM with continueListening=true when user says "yes" to a pending item', () => {
      expect(decideNextVoiceAction('Yes please', true)).toEqual({
        intent: 'CONFIRM_PENDING_ITEM',
        continueListening: true,
      });
    });

    it('Edge Case: Context-aware "No" cancels only the single item when a confirmation is pending, and keeps listening', () => {
      expect(decideNextVoiceAction('no', true)).toEqual({
        intent: 'CANCEL_PENDING_ITEM',
        continueListening: true,
      });
      expect(decideNextVoiceAction('skip that one', true)).toEqual({
        intent: 'CANCEL_PENDING_ITEM',
        continueListening: true,
      });
    });

    it('Edge Case: Context-aware "No" ends the whole session when NO item confirmation is pending (after "What else can I add?")', () => {
      expect(decideNextVoiceAction('no', false)).toEqual({
        intent: 'SESSION_ENDED',
        continueListening: false,
      });
      expect(decideNextVoiceAction('nope', false)).toEqual({
        intent: 'SESSION_ENDED',
        continueListening: false,
      });
      expect(decideNextVoiceAction('no thanks', false)).toEqual({
        intent: 'SESSION_ENDED',
        continueListening: false,
      });
    });

    it('ends the whole session immediately when user says an explicit finish phrase like "I\'m done" or "stop listening"', () => {
      expect(decideNextVoiceAction("I'm done", false)).toEqual({
        intent: 'SESSION_ENDED',
        continueListening: false,
      });
      expect(decideNextVoiceAction("I'm done", true)).toEqual({
        intent: 'SESSION_ENDED',
        continueListening: false,
      });
      expect(decideNextVoiceAction('stop listening', true)).toEqual({
        intent: 'SESSION_ENDED',
        continueListening: false,
      });
    });

    it('extracts grocery term and sets continueListening=true for standard and "no-sugar" grocery queries', () => {
      expect(decideNextVoiceAction('Can you add some organic eggs to my cart', false)).toEqual({
        intent: 'SEARCH_GROCERY_ITEM',
        groceryTerm: 'organic eggs',
        continueListening: true,
      });

      expect(decideNextVoiceAction('no sugar added greek yogurt', false)).toEqual({
        intent: 'SEARCH_GROCERY_ITEM',
        groceryTerm: 'no sugar added greek yogurt',
        continueListening: true,
      });
    });
  });

  describe('itemAddedConfirmationSpokenResponse', () => {
    it('confirms the added item, asks for additional items, and reminds the user they can say "I\'m done"', () => {
      const message = itemAddedConfirmationSpokenResponse('Kroger Whole Milk');
      expect(message).toContain('Added Kroger Whole Milk to your Kroger cart');
      expect(message).toContain('What else would you like to add?');
      expect(message).toContain("I'm still listening");
      expect(message).toContain("I'm done");
    });
  });

  describe('didUserSayYes and didUserSayNo helpers', () => {
    it('detects affirmative and negative confirmation phrases', () => {
      expect(didUserSayYes('yes please')).toBe(true);
      expect(didUserSayYes('sounds good')).toBe(true);
      expect(didUserSayNo('cancel')).toBe(true);
      expect(didUserSayNo('never mind')).toBe(true);
    });

    it('normalizes extra internal spaces when extracting grocery terms', () => {
      expect(extractGroceryTerm('  ADD   SOME   SOURDOUGH   BREAD  TO MY CART ')).toBe('sourdough bread');
    });
  });
});
