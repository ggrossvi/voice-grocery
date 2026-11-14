/**
 * Multi-Item Queue State Machine
 *
 * Manages sequential processing when a shopper speaks multiple grocery items
 * in a single sentence (e.g. "spinach, eggs and brussel sprouts").
 */

import { isUserDoneOrdering } from './voice-intent';

export interface InitializedQueue {
  currentItem: string | null;
  remainingQueue: string[];
  hasMultipleItems: boolean;
}

export interface AdvancedQueue {
  nextItem: string | null;
  remainingQueue: string[];
  hasMoreItems: boolean;
}

/**
 * Initializes the item queue from a list of parsed grocery terms.
 * The first item is extracted for immediate processing, and any remaining items
 * are queued.
 */
export function initializeItemQueue(items: string[]): InitializedQueue {
  if (!items || items.length === 0) {
    return {
      currentItem: null,
      remainingQueue: [],
      hasMultipleItems: false,
    };
  }

  const [currentItem, ...remainingQueue] = items;
  return {
    currentItem: currentItem.trim(),
    remainingQueue: remainingQueue.map(item => item.trim()),
    hasMultipleItems: remainingQueue.length > 0,
  };
}

/**
 * Advances to the next item in the queue.
 * Returns the popped item and the remaining items.
 */
export function advanceItemQueue(queue: string[]): AdvancedQueue {
  if (!queue || queue.length === 0) {
    return {
      nextItem: null,
      remainingQueue: [],
      hasMoreItems: false,
    };
  }

  const [nextItem, ...remainingQueue] = queue;
  return {
    nextItem: nextItem.trim(),
    remainingQueue,
    hasMoreItems: remainingQueue.length > 0,
  };
}

/**
 * Builds a natural spoken bridging message when transitioning from an added item
 * to the next queued item from the shopper's multi-item list.
 */
export function buildQueueContinuationPrompt(
  addedTitle: string,
  nextItem: string
): string {
  return `Added ${addedTitle} to your cart! Next from your list: searching for ${nextItem}...`;
}

/**
 * Returns true if the user's spoken intent should immediately clear any remaining items
 * in the queue (e.g. "I'm done", "That's all", "Stop listening").
 */
export function shouldClearQueueOnIntent(transcript: string): boolean {
  return isUserDoneOrdering(transcript);
}

