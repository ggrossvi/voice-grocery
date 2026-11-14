import { describe, it, expect } from 'vitest';
import { splitSpokenGroceryList } from '../src/lib/voice-intent';

describe('Multi-Item Spoken Grocery List Splitting', () => {
  describe('Standard multi-item lists', () => {
    it('splits items separated by commas and "and"', () => {
      expect(splitSpokenGroceryList('spinach, eggs and brussel sprouts')).toEqual([
        'spinach',
        'eggs',
        'brussel sprouts',
      ]);
    });

    it('splits items separated by "and" when speech recognition omits commas', () => {
      expect(splitSpokenGroceryList('spinach and eggs and milk')).toEqual([
        'spinach',
        'eggs',
        'milk',
      ]);
    });

    it('splits items with conversational prefixes and suffixes', () => {
      expect(
        splitSpokenGroceryList('can you please add spinach, organic eggs, plus bananas to my cart')
      ).toEqual(['spinach', 'organic eggs', 'bananas']);
    });

    it('splits items separated by "plus", "also", or "as well as"', () => {
      expect(
        splitSpokenGroceryList('yogurt plus sourdough bread as well as apples')
      ).toEqual(['yogurt', 'sourdough bread', 'apples']);
    });
  });

  describe('Edge Case: Compound products containing "and" must NOT split', () => {
    it('protects "mac and cheese" from being split into "mac" and "cheese"', () => {
      expect(
        splitSpokenGroceryList('mac and cheese, hot dogs and buns')
      ).toEqual(['mac and cheese', 'hot dogs', 'buns']);
    });

    it('protects "half and half"', () => {
      expect(
        splitSpokenGroceryList('half and half, and dark roast coffee')
      ).toEqual(['half and half', 'dark roast coffee']);
    });

    it('protects "salt and vinegar chips"', () => {
      expect(
        splitSpokenGroceryList('salt and vinegar chips and salsa')
      ).toEqual(['salt and vinegar chips', 'salsa']);
    });

    it('protects "pork and beans" and "cookies and cream"', () => {
      expect(
        splitSpokenGroceryList('pork and beans, cookies and cream ice cream and milk')
      ).toEqual(['pork and beans', 'cookies and cream ice cream', 'milk']);
    });
  });

  describe('Edge Cases: Single items, stuttering, and empty input', () => {
    it('returns a single-element array when only one item is spoken', () => {
      expect(splitSpokenGroceryList('spinach')).toEqual(['spinach']);
      expect(splitSpokenGroceryList('a gallon of whole milk')).toEqual(['whole milk']);
    });

    it('handles stuttering and repeated connectors gracefully', () => {
      expect(splitSpokenGroceryList('milk and... and eggs')).toEqual(['milk', 'eggs']);
      expect(splitSpokenGroceryList('spinach, and, plus eggs')).toEqual(['spinach', 'eggs']);
    });

    it('returns an empty array when input contains only connectors or empty speech', () => {
      expect(splitSpokenGroceryList('')).toEqual([]);
      expect(splitSpokenGroceryList('   ')).toEqual([]);
      expect(splitSpokenGroceryList('and, plus, and')).toEqual([]);
      expect(splitSpokenGroceryList('please add to my cart')).toEqual([]);
    });
  });
});

