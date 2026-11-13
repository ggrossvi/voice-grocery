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
import { findFavoriteItem, recordFavoriteOrder } from '@/lib/favorites';
import { searchKrogerProducts, addToKrogerCart } from '@/lib/kroger';
import {
  getUserById,
  getValidKrogerTokenForUser,
  KROGER_TOKEN_COOKIE,
  recordUserCartItem,
  USER_SESSION_COOKIE,
} from '@/lib/auth';
import { PendingConfirmation } from '@/lib/types';
import {
  decideNextVoiceAction,
  itemAddedConfirmationSpokenResponse,
} from '@/lib/voice-intent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transcript, pendingConfirmation, locationId } = body as {
      transcript: string;
      pendingConfirmation?: PendingConfirmation | null;
      locationId?: string;
    };

    const isWaitingForConfirmation = Boolean(
      pendingConfirmation &&
        pendingConfirmation.item &&
        pendingConfirmation.action === 'ADD_TO_CART'
    );

    const nextAction = decideNextVoiceAction(
      transcript || '',
      isWaitingForConfirmation
    );

    // -------------------------------------------------------------------------
    // Scenario 1: Empty speech or filler-only phrase -> stop listening
    // -------------------------------------------------------------------------
    if (nextAction.intent === 'NO_SPEECH') {
      return NextResponse.json({
        type: 'NO_SPEECH',
        spokenResponse: "I didn't catch that. Try saying something like 'I want milk' or 'yogurt'.",
        continueListening: false,
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 2: User said "I'm done", "That's all", or "No" when asked for more
    // -------------------------------------------------------------------------
    if (nextAction.intent === 'SESSION_ENDED') {
      return NextResponse.json({
        type: 'SESSION_ENDED',
        spokenResponse: "Got it! I've stopped listening. Your items are ready in your Kroger cart.",
        clearConfirmation: true,
        continueListening: false,
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 3: User confirmed or rejected a single pending item
    // -------------------------------------------------------------------------
    if (
      nextAction.intent === 'CONFIRM_PENDING_ITEM' &&
      pendingConfirmation?.item
    ) {
      const item = pendingConfirmation.item;
      const upc = 'upc' in item ? item.upc : item.krogerUpc;
      const title = 'description' in item ? item.description : item.title;

      const cookieStore = await cookies();
      const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
      const cookieToken = cookieStore.get(KROGER_TOKEN_COOKIE)?.value;
      const token = (await getValidKrogerTokenForUser(userId)) || cookieToken;

      await addToKrogerCart(upc, 1, 'PICKUP', token);
      const savedFavorite = userId
        ? await recordFavoriteOrder(item, pendingConfirmation.keyword, userId)
        : undefined;
      if (userId) {
        await recordUserCartItem(userId, item, 1, 'PICKUP');
      }

      return NextResponse.json({
        type: 'ITEM_ADDED',
        spokenResponse: itemAddedConfirmationSpokenResponse(title),
        addedItem: savedFavorite || item,
        clearConfirmation: true,
        continueListening: true,
      });
    }

    if (nextAction.intent === 'CANCEL_PENDING_ITEM') {
      return NextResponse.json({
        type: 'CANCELLED',
        spokenResponse:
          "Okay, I won't add that. What else would you like? Say \"I'm done\" when finished.",
        clearConfirmation: true,
        continueListening: true,
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 4: Search for an item (e.g. "milk", "yogurt", "apples")
    // -------------------------------------------------------------------------
    const groceryTerm =
      nextAction.intent === 'SEARCH_GROCERY_ITEM'
        ? nextAction.groceryTerm
        : '';
    const cookieStore = await cookies();
    const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
    const token = cookieStore.get(KROGER_TOKEN_COOKIE)?.value;
    const userProfile = userId ? await getUserById(userId) : null;
    const storeLocationId = locationId || userProfile?.preferredStoreId;

    // 1. Check if signed-in user already has a saved Favorite Item in Neon
    const favoriteMatch = await findFavoriteItem(groceryTerm, userId);

    if (favoriteMatch) {
      const priceText = favoriteMatch.lastPrice ? ` for $${favoriteMatch.lastPrice.toFixed(2)}` : '';
      const sizeText = favoriteMatch.size ? ` (${favoriteMatch.size})` : '';
      const spokenResponse = `Found your favorite: ${favoriteMatch.title}${sizeText}${priceText}. Would you like me to add it?`;

      return NextResponse.json({
        type: 'CONFIRMATION_NEEDED',
        spokenResponse: spokenResponse,
        continueListening: true,
        pendingConfirmation: {
          item: favoriteMatch,
          isFavorite: true,
          promptText: spokenResponse,
          action: 'ADD_TO_CART',
          keyword: groceryTerm,
        },
      });
    }

    // 2. Not in saved favorites: Search Kroger's live catalog at the user's Home Store
    const catalogMatches = await searchKrogerProducts(groceryTerm, storeLocationId, token);

    if (catalogMatches && catalogMatches.length > 0) {
      // Multiple options available: return list for user selection
      if (catalogMatches.length > 1) {
        return NextResponse.json({
          type: 'OPTIONS_NEEDED',
          spokenResponse: `I found ${catalogMatches.length} options for "${groceryTerm}" at Kroger. Which one would you prefer?`,
          options: catalogMatches,
          continueListening: false,
          pendingConfirmation: {
            options: catalogMatches,
            isFavorite: false,
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
        continueListening: true,
        pendingConfirmation: {
          item: topMatch,
          isFavorite: false,
          promptText: spokenResponse,
          action: 'ADD_TO_CART',
          keyword: groceryTerm,
        },
      });
    }

    // 3. Fallback: No matches returned by Kroger
    return NextResponse.json({
      type: 'NOT_FOUND',
      spokenResponse: `I couldn't find any products matching "${groceryTerm}" on Kroger. What else would you like to try, or say "I'm done" when finished.`,
      continueListening: true,
    });
  } catch (error: any) {
    console.error('Voice process error:', error);
    return NextResponse.json({
      type: 'ERROR',
      spokenResponse: "Sorry, I had trouble searching Kroger. Please try again.",
      error: error.message,
      continueListening: false,
    }, { status: 500 });
  }
}
