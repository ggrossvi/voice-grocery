/**
 * Natural Language Voice & Text Intent Processor
 * 
 * Supports:
 * 1. Matching existing favorites from "Usual Items" memory
 * 2. Querying live Kroger catalog when an item is not yet a favorite
 * 3. Returning multiple store options for user selection
 * 4. Handling confirmation and cancellation responses
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findUsualItem, recordOrder } from '@/lib/usuals';
import { searchKrogerProducts, addToKrogerCart } from '@/lib/kroger';
import {
  getValidKrogerTokenForUser,
  KROGER_TOKEN_COOKIE,
  recordUserCartItem,
  USER_SESSION_COOKIE,
} from '@/lib/auth';
import { PendingConfirmation } from '@/lib/types';

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transcript, pendingConfirmation } = body as {
      transcript: string;
      pendingConfirmation?: PendingConfirmation | null;
    };

    if (!transcript || !transcript.trim()) {
      return NextResponse.json({
        type: 'NO_SPEECH',
        spokenResponse: "I didn't catch that. Try saying something like 'I want milk' or 'yogurt'.",
      });
    }

    const lowerTranscript = transcript.toLowerCase().trim();

    // -------------------------------------------------------------------------
    // Scenario 1: User is confirming or rejecting a single pending item
    // -------------------------------------------------------------------------
    if (pendingConfirmation && pendingConfirmation.item && pendingConfirmation.action === 'ADD_TO_CART') {
      const isAffirmative = AFFIRMATIVE_RESPONSES.some(word => lowerTranscript.includes(word));
      const isNegative = NEGATIVE_RESPONSES.some(word => lowerTranscript.includes(word));

      if (isAffirmative) {
        const item = pendingConfirmation.item;
        const upc = 'upc' in item ? item.upc : item.krogerUpc;
        const title = 'description' in item ? item.description : item.title;

        const cookieStore = await cookies();
        const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
        const cookieToken = cookieStore.get(KROGER_TOKEN_COOKIE)?.value;
        const token = (await getValidKrogerTokenForUser(userId)) || cookieToken;

        await addToKrogerCart(upc, 1, 'PICKUP', token);
        const savedStaple = await recordOrder(item, pendingConfirmation.keyword);
        if (userId) {
          await recordUserCartItem(userId, item, 1, 'PICKUP');
        }

        return NextResponse.json({
          type: 'ITEM_ADDED',
          spokenResponse: `Added ${title} to your Kroger cart!`,
          addedItem: savedStaple,
          clearConfirmation: true,
        });
      } else if (isNegative) {
        return NextResponse.json({
          type: 'CANCELLED',
          spokenResponse: "Okay, I won't add that. What else would you like?",
          clearConfirmation: true,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Scenario 2: Search for an item (e.g. "milk", "yogurt", "apples")
    // -------------------------------------------------------------------------
    const groceryTerm = extractGroceryTerm(lowerTranscript);

    // 1. Check if user already has a saved "Usual Item" / Favorite
    const usualMatch = await findUsualItem(groceryTerm);

    if (usualMatch) {
      const priceText = usualMatch.lastPrice ? ` for $${usualMatch.lastPrice.toFixed(2)}` : '';
      const sizeText = usualMatch.size ? ` (${usualMatch.size})` : '';
      const spokenResponse = `Found your usual: ${usualMatch.title}${sizeText}${priceText}. Would you like me to add it?`;

      return NextResponse.json({
        type: 'CONFIRMATION_NEEDED',
        spokenResponse: spokenResponse,
        pendingConfirmation: {
          item: usualMatch,
          isUsual: true,
          promptText: spokenResponse,
          action: 'ADD_TO_CART',
          keyword: groceryTerm,
        },
      });
    }

    // 2. Not in saved usuals: Search Kroger's live catalog
    const cookieStore = await cookies();
    const token = cookieStore.get('kroger_token')?.value;

    const catalogMatches = await searchKrogerProducts(groceryTerm, undefined, token);

    if (catalogMatches && catalogMatches.length > 0) {
      // Multiple options available: return list for user selection
      if (catalogMatches.length > 1) {
        return NextResponse.json({
          type: 'OPTIONS_NEEDED',
          spokenResponse: `I found ${catalogMatches.length} options for "${groceryTerm}" at Kroger. Which one would you prefer?`,
          options: catalogMatches,
          pendingConfirmation: {
            options: catalogMatches,
            isUsual: false,
            promptText: `Select your preferred ${groceryTerm}:`,
            action: 'SELECT_OPTION',
            keyword: groceryTerm,
          },
        });
      }

      // Single match
      const topMatch = catalogMatches[0];
      const priceText = topMatch.price ? ` for $${topMatch.price.toFixed(2)}` : '';
      const sizeText = topMatch.size ? ` (${topMatch.size})` : '';
      const spokenResponse = `I found ${topMatch.description}${sizeText}${priceText}. Would you like to add this?`;

      return NextResponse.json({
        type: 'CONFIRMATION_NEEDED',
        spokenResponse: spokenResponse,
        pendingConfirmation: {
          item: topMatch,
          isUsual: false,
          promptText: spokenResponse,
          action: 'ADD_TO_CART',
          keyword: groceryTerm,
        },
      });
    }

    // 3. Fallback: No matches returned by Kroger
    return NextResponse.json({
      type: 'NOT_FOUND',
      spokenResponse: `I couldn't find any products matching "${groceryTerm}" on Kroger. Try searching with a brand name or different word.`,
    });
  } catch (error: any) {
    console.error('Voice process error:', error);
    return NextResponse.json({
      type: 'ERROR',
      spokenResponse: "Sorry, I had trouble searching Kroger. Please try again.",
      error: error.message,
    }, { status: 500 });
  }
}
