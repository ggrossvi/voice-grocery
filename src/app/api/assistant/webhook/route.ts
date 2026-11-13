/**
 * Universal Voice Assistant Webhook
 * 
 * Supports wake words from both ecosystems:
 * - "Hey Google, add [item] to my groceries" (Android / Google Assistant)
 * - "Hey Siri, add grocery" (Apple iOS / Siri Shortcuts)
 * 
 * Route: GET & POST /api/assistant/webhook
 * 
 * Accepts:
 * - GET: /api/assistant/webhook?item=milk
 * - POST: { "item": "milk" } or Google Assistant fulfillment payload
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findUsualItem, recordOrder } from '@/lib/usuals';
import { searchKrogerProducts, addToKrogerCart } from '@/lib/kroger';
import {
  getUserById,
  getValidKrogerTokenForUser,
  KROGER_TOKEN_COOKIE,
  recordUserCartItem,
  USER_SESSION_COOKIE,
} from '@/lib/auth';

// Helper to extract the grocery item name from varied assistant request formats
function parseIncomingItem(reqBody: any, searchParams: URLSearchParams): string {
  // 1. Direct query param: ?item=milk or ?query=milk
  if (searchParams.get('item')) return searchParams.get('item')!;
  if (searchParams.get('query')) return searchParams.get('query')!;

  if (reqBody) {
    // 2. Simple JSON payload: { "item": "milk" }
    if (reqBody.item) return reqBody.item;
    if (reqBody.query) return reqBody.query;

    // 3. Google Assistant / Dialogflow fulfillment structure
    const intentParam = reqBody?.intentInfo?.parameters?.item?.resolvedValue ||
                        reqBody?.queryResult?.parameters?.item;
    if (intentParam) return intentParam;
  }

  return '';
}

// Clean grocery text (e.g. "some milk" -> "milk")
function sanitizeTerm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^(can you\s+)?(please\s+)?(add|put|order|get|buy|i want|i need)\s+/i, '')
    .replace(/\s+(to my cart|in my cart|to the list|to groceries)$/i, '')
    .replace(/^(a gallon of|a carton of|some|a|an)\s+/i, '')
    .trim();
}

async function handleAssistantRequest(rawItem: string) {
  const itemTerm = sanitizeTerm(rawItem);

  if (!itemTerm) {
    return {
      success: false,
      spokenText: "Please specify what grocery item you would like to add.",
    };
  }

  // 1. Check your "Usual Items" database first
  const usual = await findUsualItem(itemTerm);

  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const cookieToken = cookieStore.get(KROGER_TOKEN_COOKIE)?.value;
  const token = (await getValidKrogerTokenForUser(userId)) || cookieToken;
  const userProfile = userId ? await getUserById(userId) : null;
  const storeLocationId = userProfile?.preferredStoreId;

  if (usual) {
    // Add your usual item to the Kroger cart
    await addToKrogerCart(usual.krogerUpc, 1, 'PICKUP', token);
    await recordOrder(usual);
    if (userId) {
      await recordUserCartItem(userId, usual, 1, 'PICKUP');
    }

    const price = usual.lastPrice ? ` for $${usual.lastPrice.toFixed(2)}` : '';
    return {
      success: true,
      item: usual,
      spokenText: `Added your usual ${usual.title}${price} to your Kroger cart.`,
    };
  }

  // 2. If not in usuals, search Kroger catalog at Home Store and add top match
  const matches = await searchKrogerProducts(itemTerm, storeLocationId, token);
  if (matches.length > 0) {
    const topItem = matches[0];
    await addToKrogerCart(topItem.upc, 1, 'PICKUP', token);
    const savedStaple = await recordOrder(topItem, itemTerm);
    if (userId) {
      await recordUserCartItem(userId, topItem, 1, 'PICKUP');
    }

    const price = topItem.price ? ` for $${topItem.price.toFixed(2)}` : '';
    return {
      success: true,
      item: savedStaple,
      spokenText: `Found and added ${topItem.description}${price} to your Kroger cart.`,
    };
  }

  return {
    success: false,
    spokenText: `I couldn't find ${itemTerm} at Kroger. Would you like to try a different name?`,
  };
}

// Handler for GET requests (ideal for quick Siri Shortcuts or browser queries)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawItem = parseIncomingItem(null, searchParams);
  const result = await handleAssistantRequest(rawItem);

  // Return standard JSON as well as text/plain so Siri or Google Assistant can read it directly
  return NextResponse.json({
    ...result,
    // Google Assistant fulfillment response compatibility
    fulfillmentResponse: {
      messages: [{ text: { text: [result.spokenText] } }]
    }
  });
}

// Handler for POST requests (ideal for Google Assistant webhooks and Siri POST actions)
export async function POST(request: Request) {
  let body = null;
  try {
    body = await request.json();
  } catch (e) {
    // Body is optional if query params are provided
  }

  const { searchParams } = new URL(request.url);
  const rawItem = parseIncomingItem(body, searchParams);
  const result = await handleAssistantRequest(rawItem);

  return NextResponse.json({
    ...result,
    fulfillmentResponse: {
      messages: [{ text: { text: [result.spokenText] } }]
    }
  });
}
