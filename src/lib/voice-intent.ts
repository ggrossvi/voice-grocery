/**
 * Voice Intent & Continuous Conversation Helpers
 *
 * Centralizes natural language parsing for the voice assistant so that:
 * 1. Spoken filler words ("can you please add some...") are stripped cleanly.
 * 2. Continuous multi-item sessions know when to keep listening vs. when to stop.
 * 3. Context-sensitive replies like "No" behave appropriately depending on
 *    whether an item confirmation is currently pending on screen.
 */

const CLEANUP_PATTERNS = [
  /^(can you\s+)?(please\s+)?(add|put|order|get|buy|i want|i need|we need)\s+/i,
  /\s+(to my cart|in my cart|to the list|to my list|to cart|to groceries|to my groceries)$/i,
  /^(a gallon of|a carton of|a loaf of|a bottle of|a box of|a bag of|some|a|an)\s+/i,
];

/**
 * Phrases that mean the user has finished adding items and wants the microphone
 * to stop listening completely.
 *
 * Why we use anchored/phrase patterns instead of `.includes('no')`:
 * A naive `.includes('no')` or `.includes('stop')` would accidentally block
 * real grocery searches like "no sugar added yogurt", "non-dairy milk", or "gobstoppers".
 */
const DONE_ORDERING_PATTERNS = [
  /^(no\s+)?(i'm|im|i am)\s+(all\s+)?done(\s+thanks|\s+thank you)?$/i,
  /^(no\s+)?(that's|thats|that is)\s+(all|it)(\s+for now)?(\s+thanks|\s+thank you)?$/i,
  /^(no\s+)?nothing\s+else(\s+for now)?(\s+thanks|\s+thank you)?$/i,
  /^no\s+more(\s+items|\s+groceries)?(\s+thanks|\s+thank you)?$/i,
  /^no\s+(thanks|thank you)$/i,
  /^all\s+done(\s+thanks|\s+thank you)?$/i,
  /^stop(\s+listening)?$/i,
  /^(finished|done|goodbye|bye)$/i,
];

/**
 * Standalone negative responses that mean:
 * - "Cancel this item" when a product confirmation card is on screen, OR
 * - "I'm done adding items" when the assistant just asked "What else would you like to add?"
 */
const STANDALONE_NO_PATTERNS = [
  /^(no|nope|nah)(\s+thanks|\s+thank you)?$/i,
];

const YES_RESPONSES = [
  'yes',
  'yeah',
  'yep',
  'sure',
  'add it',
  'please',
  'yes please',
  'do it',
  'confirm',
  'okay',
  'ok',
  'yup',
  'sounds good',
];

const NO_RESPONSES = [
  'no',
  'nope',
  'cancel',
  'never mind',
  "don't add",
  'dont add',
  'skip',
  'different one',
];

export type NextVoiceAction =
  | { intent: 'NO_SPEECH'; continueListening: false }
  | { intent: 'SESSION_ENDED'; continueListening: false }
  | { intent: 'CONFIRM_PENDING_ITEM'; continueListening: true }
  | { intent: 'CANCEL_PENDING_ITEM'; continueListening: true }
  | { intent: 'SEARCH_GROCERY_ITEM'; groceryTerm: string; continueListening: true };

/**
 * Normalizes punctuation and extra spaces so spoken phrases can be matched reliably.
 */
function normalizeSpokenText(spokenText: string): string {
  return spokenText
    .toLowerCase()
    .replace(/[.,!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Common compound grocery product phrases containing the word "and"
 * that must not be split into separate items.
 */
const COMPOUND_PRODUCT_PHRASES = [
  'mac and cheese',
  'macaroni and cheese',
  'half and half',
  'salt and vinegar',
  'salt and pepper',
  'pork and beans',
  'cookies and cream',
  'sweet and sour',
  'bread and butter',
  'peaches and cream',
  'strawberries and cream',
  'oil and vinegar',
];

/**
 * Strips conversational prefixes ("can you add"), containers ("a gallon of"),
 * and suffixes ("to my cart") to isolate the core grocery search term.
 */
export function extractGroceryTerm(spokenText: string): string {
  let cleaned = normalizeSpokenText(spokenText);

  // If the entire phrase is only a request verb/suffix with no item (e.g. "please add to my cart"),
  // return an empty string so we don't search Kroger for "please add".
  if (/^(can you\s+)?(please\s+)?(add|put|order|get|buy)(\s+(to my cart|in my cart|to cart|to groceries))?$/i.test(cleaned)) {
    return '';
  }

  for (const pattern of CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Splits a naturally spoken sentence into individual grocery items while
 * protecting compound items that contain "and" (e.g. "mac and cheese", "half and half").
 *
 * Example:
 *   "I want spinach, eggs and brussel sprouts" -> ['spinach', 'eggs', 'brussel sprouts']
 *   "mac and cheese, hot dogs and buns"        -> ['mac and cheese', 'hot dogs', 'buns']
 */
export function splitSpokenGroceryList(spokenText: string): string[] {
  if (!spokenText || !spokenText.trim()) {
    return [];
  }

  // 1. Remove leading intent prefixes and trailing destination suffixes
  let cleaned = spokenText.toLowerCase().trim();
  for (const pattern of CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  if (!cleaned) {
    return [];
  }

  // 2. Protect compound items containing "and" with temporary tokens
  const protectedMap = new Map<string, string>();
  COMPOUND_PRODUCT_PHRASES.forEach((phrase, index) => {
    if (cleaned.includes(phrase)) {
      const placeholder = `__COMPOUND_ITEM_${index}__`;
      protectedMap.set(placeholder, phrase);
      cleaned = cleaned.replaceAll(phrase, placeholder);
    }
  });

  // 3. Normalize natural speech list delimiters
  // First collapse ellipses and stutters like "and... and", ", and,", "plus and"
  let delimited = cleaned
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+(and|plus|also|as well as|then)(\s+(and|plus|also|as well as|then))+/gi, ' $1 ')
    .replace(/[,;]+/g, '|')
    .replace(/\s+(and|plus|also|as well as|then)\s+/gi, '|')
    // Handle repeated connectors or double delimiters like "| |"
    .replace(/\|\s*\|+/g, '|');

  // 4. Split by delimiter, restore protected phrases, and clean each item
  const rawSegments = delimited.split('|');
  const items: string[] = [];

  for (const segment of rawSegments) {
    let restored = segment;
    for (const [placeholder, originalPhrase] of protectedMap.entries()) {
      restored = restored.replaceAll(placeholder, originalPhrase);
    }

    // Clean trailing or leading connector artifacts
    restored = restored
      .replace(/^(and|plus|also|then)\s+/i, '')
      .replace(/\s+(and|plus|also|then)$/i, '')
      .trim();

    const itemTerm = extractGroceryTerm(restored);
    // Ignore empty tokens, loose connector words, or cart phrases spoken alone
    if (
      itemTerm &&
      !/^(and|plus|also|then|as well as|to my cart|in my cart|to cart)$/i.test(itemTerm)
    ) {
      items.push(itemTerm);
    }
  }

  return items;
}

/**
 * Returns true when the user spoke an explicit session-ending phrase
 * such as "I'm done", "That's all", "Nothing else", or "Stop listening".
 */
export function isUserDoneOrdering(spokenText: string): boolean {
  const normalized = normalizeSpokenText(spokenText);
  if (!normalized) return false;

  return DONE_ORDERING_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Returns true if the user is confirming a pending grocery item ("yes", "sounds good", etc.).
 */
export function didUserSayYes(spokenText: string): boolean {
  const normalized = normalizeSpokenText(spokenText);
  if (!normalized) return false;

  const words = normalized.split(' ');
  return YES_RESPONSES.some(phrase =>
    phrase.includes(' ') ? normalized.includes(phrase) : words.includes(phrase)
  );
}

/**
 * Returns true if the user is rejecting a pending grocery item ("no", "skip", "cancel", etc.).
 */
export function didUserSayNo(spokenText: string): boolean {
  const normalized = normalizeSpokenText(spokenText);
  if (!normalized) return false;

  const words = normalized.split(' ');
  return NO_RESPONSES.some(phrase =>
    phrase.includes(' ') ? normalized.includes(phrase) : words.includes(phrase)
  );
}

/**
 * Decides what action the voice assistant should take next based on what the user said
 * (`spokenText`) and whether an item confirmation card is currently waiting on screen
 * (`isWaitingForConfirmation`), along with whether the microphone should stay open.
 */
export function decideNextVoiceAction(
  spokenText: string,
  isWaitingForConfirmation: boolean
): NextVoiceAction {
  const normalized = normalizeSpokenText(spokenText);

  // 1. Empty transcript or silence -> stop listening to avoid infinite loops
  if (!normalized) {
    return { intent: 'NO_SPEECH', continueListening: false };
  }

  // 2. Explicit "I'm done / That's all / Stop listening" always ends the session
  if (isUserDoneOrdering(normalized)) {
    return { intent: 'SESSION_ENDED', continueListening: false };
  }

  // 3. When an item confirmation card is currently on screen:
  if (isWaitingForConfirmation) {
    if (didUserSayYes(normalized)) {
      return { intent: 'CONFIRM_PENDING_ITEM', continueListening: true };
    }
    if (didUserSayNo(normalized)) {
      return { intent: 'CANCEL_PENDING_ITEM', continueListening: true };
    }
  } else {
    // 4. When NO item confirmation is pending (e.g. right after "What else would you like to add?"),
    // a standalone "No" or "Nope" means the user does not want any more items.
    if (STANDALONE_NO_PATTERNS.some(pattern => pattern.test(normalized))) {
      return { intent: 'SESSION_ENDED', continueListening: false };
    }
  }

  // 5. Otherwise, treat the utterance as a grocery item search
  const groceryTerm = extractGroceryTerm(normalized);
  if (!groceryTerm) {
    return { intent: 'NO_SPEECH', continueListening: false };
  }

  return {
    intent: 'SEARCH_GROCERY_ITEM',
    groceryTerm,
    continueListening: true,
  };
}

/**
 * Creates the spoken confirmation after an item is added to the cart,
 * letting the user know what was added, asking if they want anything else,
 * and reminding them how to stop the continuous listener.
 */
export function itemAddedConfirmationSpokenResponse(itemTitle: string): string {
  return `Added ${itemTitle} to your Kroger cart! What else would you like to add? I'm still listening, or say "I'm done" when finished.`;
}
