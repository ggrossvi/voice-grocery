import { describe, it, expect } from 'vitest';
import {
  initializeItemQueue,
  advanceItemQueue,
  buildQueueContinuationPrompt,
  shouldClearQueueOnIntent,
} from '../src/lib/item-queue';

describe('Multi-Item Queue State Machine', () => {
  describe('initializeItemQueue', () => {
    it('initializes head item for immediate search and queues the remaining items', () => {
      const result = initializeItemQueue(['spinach', 'eggs', 'brussel sprouts']);
      expect(result).toEqual({
        currentItem: 'spinach',
        remainingQueue: ['eggs', 'brussel sprouts'],
        hasMultipleItems: true,
      });
    });

    it('handles single-item arrays with empty remaining queue', () => {
      const result = initializeItemQueue(['milk']);
      expect(result).toEqual({
        currentItem: 'milk',
        remainingQueue: [],
        hasMultipleItems: false,
      });
    });

    it('handles empty input gracefully', () => {
      const result = initializeItemQueue([]);
      expect(result).toEqual({
        currentItem: null,
        remainingQueue: [],
        hasMultipleItems: false,
      });
    });
  });

  describe('advanceItemQueue', () => {
    it('pops the next item from the queue and returns remaining items', () => {
      const result = advanceItemQueue(['eggs', 'brussel sprouts']);
      expect(result).toEqual({
        nextItem: 'eggs',
        remainingQueue: ['brussel sprouts'],
        hasMoreItems: true,
      });
    });

    it('identifies when the queue becomes empty after popping the last item', () => {
      const result = advanceItemQueue(['brussel sprouts']);
      expect(result).toEqual({
        nextItem: 'brussel sprouts',
        remainingQueue: [],
        hasMoreItems: false,
      });
    });

    it('returns null when called with an empty queue', () => {
      const result = advanceItemQueue([]);
      expect(result).toEqual({
        nextItem: null,
        remainingQueue: [],
        hasMoreItems: false,
      });
    });
  });

  describe('buildQueueContinuationPrompt', () => {
    it('builds a natural conversational bridge when advancing to the next queued item', () => {
      const prompt = buildQueueContinuationPrompt('Organic Spinach', 'eggs');
      expect(prompt).toContain('Added Organic Spinach to your cart!');
      expect(prompt).toContain('Next from your list: searching for eggs...');
    });
  });

  describe('shouldClearQueueOnIntent', () => {
    it('returns true when user says an explicit stop phrase', () => {
      expect(shouldClearQueueOnIntent("I'm done")).toBe(true);
      expect(shouldClearQueueOnIntent("that's all")).toBe(true);
      expect(shouldClearQueueOnIntent('stop listening')).toBe(true);
    });

    it('returns false for ordinary confirmations or grocery names', () => {
      expect(shouldClearQueueOnIntent('yes')).toBe(false);
      expect(shouldClearQueueOnIntent('sure add it')).toBe(false);
      expect(shouldClearQueueOnIntent('organic eggs')).toBe(false);
    });
  });
});

