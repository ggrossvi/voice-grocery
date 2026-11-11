/**
 * Private Kroger API Credentials Verifier
 * Tests against both Production (api.kroger.com) and Certification (api-ce.kroger.com)
 */

let clientId = process.env.KROGER_CLIENT_ID || '';
let clientSecret = process.env.KROGER_CLIENT_SECRET || '';

// Clean potential quotes and whitespace
clientId = clientId.replace(/^["']|["']$/g, '').trim();
clientSecret = clientSecret.replace(/^["']|["']$/g, '').trim();

console.log('\n======================================================');
console.log('       KROGER API CREDENTIALS VERIFICATION');
console.log('======================================================\n');

if (!clientId || !clientSecret) {
  console.error('❌ [MISSING CREDENTIALS] Client ID or Secret missing in .env');
  process.exit(1);
}

console.log(`• Client ID (sanitized)     : ${clientId.substring(0, 4)}•••••••• (${clientId.length} chars)`);
console.log(`• Client Secret (sanitized) : •••••••••••• (${clientSecret.length} chars)\n`);

async function testEndpoint(urlLabel, baseUrl) {
  console.log(`• Testing [${urlLabel}] -> ${baseUrl}/v1/connect/oauth2/token`);
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`${baseUrl}/v1/connect/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'product.compact',
      }).toString(),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ SUCCESS on ${urlLabel}! Token generated (expires in ${data.expires_in}s)`);
      return { success: true, baseUrl, token: data.access_token };
    } else {
      const errText = await response.text();
      console.log(`  ❌ Rejected (${response.status}): ${errText}`);
      return { success: false };
    }
  } catch (err) {
    console.log(`  ❌ Network error on ${urlLabel}: ${err.message}`);
    return { success: false };
  }
}

async function run() {
  // Test 1: Production
  const prod = await testEndpoint('Production', 'https://api.kroger.com');
  if (prod.success) {
    console.log('\n🎉 Your credentials belong to Kroger PRODUCTION!');
    console.log('Set KROGER_BASE_URL=https://api.kroger.com in your .env');
    process.exit(0);
  }

  // Test 2: Certification / Sandbox
  console.log('');
  const cert = await testEndpoint('Certification / Sandbox', 'https://api-ce.kroger.com');
  if (cert.success) {
    console.log('\n🎉 Your credentials belong to Kroger CERTIFICATION (SANDBOX)!');
    console.log('Set KROGER_BASE_URL=https://api-ce.kroger.com in your .env');
    process.exit(0);
  }

  console.log('\n======================================================');
  console.log('⚠️ Both Production and Certification rejected these credentials.');
  console.log('Please double-check developer.kroger.com:');
  console.log('1. Verify your App status is Active.');
  console.log('2. Ensure you copied the Client Secret directly after generating it.');
  console.log('======================================================\n');
}

run();
