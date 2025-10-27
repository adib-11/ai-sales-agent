// Quick script to check and subscribe page to webhooks
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Decrypt function (same as in encryption.ts)
function decrypt(encryptedText) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function checkAndSubscribePage() {
  try {
    // Get the Facebook page connection
    const connection = await prisma.facebookPageConnection.findFirst();
    
    if (!connection) {
      console.log('❌ No Facebook page connection found');
      return;
    }

    console.log('✅ Found page connection:', connection.page_name);
    console.log('   Page ID:', connection.facebook_page_id);

    // Decrypt the page access token
    const pageAccessToken = decrypt(connection.page_access_token);

    // Subscribe the page to the app
    console.log('\n📡 Subscribing page to app webhooks...');
    
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${connection.facebook_page_id}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_referrals'],
          access_token: pageAccessToken,
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('✅ Page successfully subscribed to app webhooks!');
    } else {
      console.log('❌ Subscription failed:', result);
    }

    // Check current subscription status
    console.log('\n🔍 Checking current subscription status...');
    const statusResponse = await fetch(
      `https://graph.facebook.com/v21.0/${connection.facebook_page_id}/subscribed_apps?access_token=${pageAccessToken}`
    );

    const status = await statusResponse.json();
    console.log('Current subscriptions:', JSON.stringify(status, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndSubscribePage();
