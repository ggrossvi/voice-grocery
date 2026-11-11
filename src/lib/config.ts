/**
 * Kroger API & App Configuration
 * 
 * Manages API endpoints, OAuth configurations, and fallback sandbox modes.
 * To use your real Kroger account, create a '.env.local' file with:
 *   KROGER_CLIENT_ID=your_client_id
 *   KROGER_CLIENT_SECRET=your_client_secret
 *   KROGER_REDIRECT_URI=http://localhost:3000/api/auth/kroger/callback
 */

export const APP_CONFIG = {
  // Application metadata
  appName: 'VoiceGroceries',
  appVersion: '1.0.0',

  // Kroger API Host Configuration
  kroger: {
    // Production API Base URL
    baseUrl: process.env.KROGER_BASE_URL || 'https://api.kroger.com',
    
    // OAuth Authorization URL (where customer is sent to log in with Kroger credentials)
    authorizeUrl: 'https://api.kroger.com/v1/connect/oauth2/authorize',
    
    // OAuth Token Exchange URL
    tokenUrl: 'https://api.kroger.com/v1/connect/oauth2/token',
    
    // Registered OAuth Client ID and Secret from developer.kroger.com
    clientId: process.env.KROGER_CLIENT_ID || '',
    clientSecret: process.env.KROGER_CLIENT_SECRET || '',
    
    // OAuth Redirect Callback URI
    redirectUri: process.env.KROGER_REDIRECT_URI || 'http://localhost:3000/api/auth/kroger/callback',
    
    // Requested OAuth Scopes
    // - cart.basic:write : Required for adding items to the active cart
    // - product.compact  : Required for catalog item lookup
    // - profile.compact  : Required for customer profile identification
    scopes: 'cart.basic:write product.compact profile.compact',
    
    // Default store location ID (can be customized per user/zip code)
    // 01400943 is a standard Kroger store location ID
    defaultLocationId: process.env.KROGER_DEFAULT_LOCATION_ID || '01400943',

    // Checks if real Kroger credentials have been configured
    isConfigured(): boolean {
      return Boolean(this.clientId && this.clientSecret);
    }
  }
};
