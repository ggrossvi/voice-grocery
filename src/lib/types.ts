/**
 * VoiceGroceries Data Types & Schema Definitions
 * 
 * Supports Kroger items, staples memory, voice conversational loops,
 * and 5-store location lookup.
 */

// Represents an individual store returned by Kroger Locations API
export interface KrogerStoreLocation {
  locationId: string;
  name: string;
  chain: string; // e.g. "QFC", "Fred Meyer", "Kroger", "Ralphs"
  address: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
  };
  distanceMiles?: number;
  phone?: string;
}

// Represents an individual item returned by the Kroger Products API
export interface KrogerProduct {
  upc: string;
  description: string;
  brand?: string;
  size?: string;
  price?: number;
  imageUrl?: string;
  category?: string;
  inStock?: boolean;
}

// Represents a saved "Usual Item" / staple in the local database
export interface UsualItem {
  id: string;
  spokenKeyword: string;
  krogerUpc: string;
  title: string;
  brand?: string;
  size?: string;
  lastPrice?: number;
  imageUrl?: string;
  orderCount: number;
  lastOrderedAt: string;
  isStaple: boolean;
}

// Request payload sent to Kroger Cart API (PUT /v1/cart/add)
export interface KrogerCartAddRequest {
  items: Array<{
    quantity: number;
    upc: string;
    modality?: 'DELIVERY' | 'PICKUP';
  }>;
}

// Represents an item currently in the active session cart
export interface CartItem {
  id: string;
  upc: string;
  title: string;
  brand?: string;
  size?: string;
  price?: number;
  imageUrl?: string;
  quantity: number;
  addedAt: string;
}

// Voice conversation engine states
export type VoiceStatus = 
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'confirming'
  | 'speaking'
  | 'error';

// Pending confirmation object (supports single staple or multiple catalog choices)
export interface PendingConfirmation {
  item?: KrogerProduct | UsualItem;
  options?: KrogerProduct[];
  isUsual: boolean;
  promptText: string;
  action: 'ADD_TO_CART' | 'SELECT_OPTION';
  keyword?: string;
}

export interface VoiceMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedItem?: KrogerProduct | UsualItem;
}

// Authenticated user profile keyed by Google Sign-In ID
export interface UserProfile {
  id: string; // Google Sign-In ID (`sub`)
  email: string;
  name?: string;
  image?: string;
  preferredStoreId?: string;
  krogerConnected: boolean;
  krogerConnectedAt?: string;
  cartRemindersEnabled: boolean;
  lastCartActivityAt?: string;
  lastCartRemindedAt?: string;
}

// Reminder payload for users who have items waiting in their Kroger cart
export interface CartReminderSummary {
  userId: string;
  email: string;
  name?: string;
  itemCount: number;
  items: CartItem[];
  lastCartActivityAt?: string;
  reminderMessage: string;
}
